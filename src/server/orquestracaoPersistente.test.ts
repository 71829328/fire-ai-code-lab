import { describe, expect, it } from "vitest";
import { criarRun, iniciar } from "../orchestration/engine";
import { DEFAULT_ENGINE_CONFIG, type MissionRun } from "../orchestration/types";
import { lerConfig } from "./config";
import {
  backoffMs,
  CONFIGURACAO_LEASE_PADRAO,
  deveAguardarBackoff,
  GerenciadorLeases,
  processarComRecuperacao,
} from "./orquestracaoPersistente";
import type { Contexto } from "./servico";
import { criarEstadoServidorSeed, RepositorioMemoria, type MissaoServidor } from "./store";

const AGORA = "2026-06-01T12:00:00.000Z";
const ORG = "org-demo";

const missao: MissaoServidor = {
  id: "msn-1",
  organizacaoId: ORG,
  codigo: "LAB-1",
  titulo: "Missão",
  prioridade: "media",
  status: "pendente",
  dependencias: [],
  agenteId: null,
  instrucoes: "",
  criteriosAceite: [],
  objetivo: "objetivo",
  criadoEm: AGORA,
};

function repoCom(runs: MissionRun[]): RepositorioMemoria {
  const estado = criarEstadoServidorSeed();
  estado.missoes = [missao];
  estado.runs = runs;
  return new RepositorioMemoria(estado);
}

function contexto(repo: RepositorioMemoria): Contexto {
  return { repo, config: lerConfig({}) };
}

function relogio(inicio = 1_000_000) {
  let agora = inicio;
  return { agora: () => agora, avancar: (ms: number) => (agora += ms) };
}

describe("Gerenciador de leases", () => {
  it("impede que a mesma execução seja processada por dois donos", () => {
    const r = relogio();
    const leases = new GerenciadorLeases(CONFIGURACAO_LEASE_PADRAO, r.agora);
    const primeiro = leases.adquirir("run-1");
    expect(primeiro).not.toBeNull();
    expect(leases.adquirir("run-1")).toBeNull();
    expect(leases.ativo("run-1")).toBe(true);
  });

  it("libera o lease após expirar e permite reaquisição (heartbeat ausente)", () => {
    const r = relogio();
    const leases = new GerenciadorLeases({ duracaoMs: 1000, ttlMs: 500 }, r.agora);
    leases.adquirir("run-1");
    r.avancar(1001);
    expect(leases.ativo("run-1")).toBe(false);
    expect(leases.expirados()).toContain("run-1");
    expect(leases.adquirir("run-1")).not.toBeNull();
  });

  it("renovar estende a validade (heartbeat)", () => {
    const r = relogio();
    const leases = new GerenciadorLeases({ duracaoMs: 1000, ttlMs: 500 }, r.agora);
    leases.adquirir("run-1");
    r.avancar(900);
    expect(leases.renovar("run-1")).toBe(true);
    r.avancar(900);
    expect(leases.ativo("run-1")).toBe(true);
  });

  it("liberar remove o lease", () => {
    const leases = new GerenciadorLeases();
    leases.adquirir("run-1");
    leases.liberar("run-1");
    expect(leases.ativo("run-1")).toBe(false);
  });
});

describe("backoff exponencial", () => {
  it("cresce exponencialmente e respeita o teto", () => {
    expect(backoffMs(0, 500)).toBe(0);
    expect(backoffMs(1, 500)).toBe(500);
    expect(backoffMs(2, 500)).toBe(1000);
    expect(backoffMs(3, 500)).toBe(2000);
    expect(backoffMs(20, 500, 60_000)).toBe(60_000);
  });

  it("uma execução que já falhou só reinicia após o backoff", () => {
    const run = { ...criarRun({ organizacaoId: ORG, missao, agora: AGORA }), tentativas: [{ numero: 1, inicio: AGORA, fim: AGORA, status: "falha" as const, erro: "x", resultado: null }] };
    const agoraMs = Date.parse(AGORA);
    expect(deveAguardarBackoff(run, agoraMs, DEFAULT_ENGINE_CONFIG)).toBe(true);
    expect(deveAguardarBackoff(run, agoraMs + 10_000, DEFAULT_ENGINE_CONFIG)).toBe(false);
  });

  it("execução sem tentativas ou já em execução não aguarda backoff", () => {
    const enfileirada = criarRun({ organizacaoId: ORG, missao, agora: AGORA });
    expect(deveAguardarBackoff(enfileirada, Date.parse(AGORA), DEFAULT_ENGINE_CONFIG)).toBe(false);
    const executando = iniciar(enfileirada, AGORA);
    expect(deveAguardarBackoff(executando, Date.parse(AGORA), DEFAULT_ENGINE_CONFIG)).toBe(false);
  });
});

describe("ciclo com recuperação", () => {
  it("recupera execução 'executando' ORFÃ (sem lease ativo)", async () => {
    const executando = iniciar(criarRun({ organizacaoId: ORG, missao, agora: AGORA, id: "run-orfao" }), AGORA);
    const repo = repoCom([executando]);
    const leases = new GerenciadorLeases();

    const ciclo = await processarComRecuperacao(contexto(repo), leases, ORG, DEFAULT_ENGINE_CONFIG);
    expect(ciclo.recuperados).toContain("run-orfao");

    const depois = await repo.buscarRun(ORG, "run-orfao");
    expect(depois?.status).toBe("enfileirada");
    // Como acabou de falhar, entra em backoff e NÃO reinicia no mesmo ciclo.
    expect(ciclo.aguardandoBackoff).toContain("run-orfao");
    expect(ciclo.iniciados).not.toContain("run-orfao");
  });

  it("NÃO recupera execução cujo lease está ativo (evita execução dupla)", async () => {
    const executando = iniciar(criarRun({ organizacaoId: ORG, missao, agora: AGORA, id: "run-vivo" }), AGORA);
    const repo = repoCom([executando]);
    const leases = new GerenciadorLeases();
    leases.adquirir("run-vivo");

    const ciclo = await processarComRecuperacao(contexto(repo), leases, ORG, DEFAULT_ENGINE_CONFIG);
    expect(ciclo.recuperados).toHaveLength(0);
    const depois = await repo.buscarRun(ORG, "run-vivo");
    expect(depois?.status).toBe("executando");
  });

  it("inicia execução pronta e registra lease", async () => {
    const repo = repoCom([criarRun({ organizacaoId: ORG, missao, agora: AGORA, id: "run-novo" })]);
    const leases = new GerenciadorLeases();
    const ciclo = await processarComRecuperacao(contexto(repo), leases, ORG, DEFAULT_ENGINE_CONFIG);
    expect(ciclo.iniciados).toContain("run-novo");
    expect(leases.ativo("run-novo")).toBe(true);
  });
});
