// =====================================================================
// FIRE Agent Command Center — LAB-004
// Orquestração persistente (server-side).
//
// Diferente dos temporizadores do navegador, a execução aqui é conduzida no
// servidor sobre a fila PERSISTIDA no repositório. O que é acrescentado:
//   - locks/leases por execução (evita processamento duplo);
//   - heartbeat (renovação de lease) e detecção de execuções interrompidas;
//   - recuperação após reinicialização (lease ausente/expirado ⇒ recupera);
//   - retentativas com backoff exponencial;
//   - idempotência (garantida no enfileiramento + índice único no banco);
//   - controle de concorrência e timeout (delegados ao motor determinístico).
//
// LIMITAÇÃO HONESTA: os leases vivem em memória da instância. Em ambiente
// multi-instância, a coordenação exige armazenamento compartilhado (ex.: uma
// tabela de leases no Supabase). Isso está registrado em docs/LAB-004.
// =====================================================================

import { randomUUID } from "node:crypto";
import { falhar, processar } from "../orchestration/engine";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig, type MissionRun } from "../orchestration/types";
import type { Contexto } from "./servico";

export interface Lease {
  runId: string;
  id: string;
  adquiridoEm: number;
  heartbeatEm: number;
  expiraEm: number;
}

export interface ConfiguracaoLease {
  duracaoMs: number;
  ttlMs: number;
}

export const CONFIGURACAO_LEASE_PADRAO: ConfiguracaoLease = {
  duracaoMs: 30_000,
  ttlMs: 15_000,
};

export class GerenciadorLeases {
  private readonly leases = new Map<string, Lease>();

  constructor(
    private readonly config: ConfiguracaoLease = CONFIGURACAO_LEASE_PADRAO,
    private readonly relogio: () => number = () => Date.now()
  ) {}

  adquirir(runId: string): Lease | null {
    const agora = this.relogio();
    const existente = this.leases.get(runId);
    if (existente && existente.expiraEm > agora) return null; // já detido por outro dono
    const lease: Lease = {
      runId,
      id: randomUUID(),
      adquiridoEm: agora,
      heartbeatEm: agora,
      expiraEm: agora + this.config.duracaoMs,
    };
    this.leases.set(runId, lease);
    return lease;
  }

  renovar(runId: string): boolean {
    const lease = this.leases.get(runId);
    if (!lease) return false;
    const agora = this.relogio();
    lease.heartbeatEm = agora;
    lease.expiraEm = agora + this.config.duracaoMs;
    return true;
  }

  liberar(runId: string): void {
    this.leases.delete(runId);
  }

  obter(runId: string): Lease | null {
    return this.leases.get(runId) ?? null;
  }

  ativo(runId: string): boolean {
    const lease = this.leases.get(runId);
    return !!lease && lease.expiraEm > this.relogio();
  }

  expirados(): string[] {
    const agora = this.relogio();
    return [...this.leases.values()].filter((l) => l.expiraEm <= agora).map((l) => l.runId);
  }

  ativos(): Lease[] {
    const agora = this.relogio();
    return [...this.leases.values()].filter((l) => l.expiraEm > agora);
  }
}

/** Backoff exponencial: base * 2^(tentativas-1), limitado a um teto. */
export function backoffMs(tentativas: number, baseMs: number, tetoMs = 60_000): number {
  if (tentativas <= 0) return 0;
  const valor = baseMs * Math.pow(2, tentativas - 1);
  return Math.min(valor, tetoMs);
}

/** Uma execução enfileirada que já falhou só pode reiniciar após o backoff. */
export function deveAguardarBackoff(run: MissionRun, agoraMs: number, config: EngineConfig): boolean {
  if (run.status !== "enfileirada") return false;
  if (run.tentativas.length === 0) return false;
  const espera = backoffMs(run.tentativas.length, config.retentativaBaseMs);
  return Date.parse(run.atualizadoEm) + espera > agoraMs;
}

export interface ResultadoCiclo {
  recuperados: string[];
  iniciados: string[];
  expirados: string[];
  aguardandoBackoff: string[];
  mensagens: string[];
}

/**
 * Executa um ciclo completo de orquestração persistente:
 *   1. recupera execuções cujo lease expirou/desapareceu (interrompidas);
 *   2. separa as execuções em backoff das elegíveis;
 *   3. roda o motor no subconjunto elegível;
 *   4. marca como lease as execuções iniciadas.
 */
export async function processarComRecuperacao(
  ctx: Contexto,
  leases: GerenciadorLeases,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): Promise<ResultadoCiclo> {
  const agora = (ctx.agora ?? (() => new Date().toISOString()))();
  const agoraMs = Date.parse(agora);
  const resultado: ResultadoCiclo = { recuperados: [], iniciados: [], expirados: [], aguardandoBackoff: [], mensagens: [] };

  const organizacoes = await ctx.repo.listarOrganizacoes();
  for (const organizacao of organizacoes) {
    const runs = await ctx.repo.listarRuns(organizacao.id);
    if (runs.length === 0) continue;

    // 1. Recuperação: "executando" sem lease ativo = interrompida (restart/crash).
    const recuperadas: MissionRun[] = [];
    for (const run of runs) {
      if (run.status === "executando" && !leases.ativo(run.id)) {
        const recuperada = falhar(run, "Execução interrompida (lease ausente/expirado).", agora, config);
        await ctx.repo.salvarRun(recuperada);
        recuperadas.push(recuperada);
        resultado.recuperados.push(run.id);
        resultado.mensagens.push(`${run.missaoCodigo}: execução interrompida recuperada.`);
      }
    }
    const aposRecuperacao = runs.map((r) => recuperadas.find((x) => x.id === r.id) ?? r);

    // 2. Backoff.
    const elegiveis: MissionRun[] = [];
    for (const run of aposRecuperacao) {
      if (deveAguardarBackoff(run, agoraMs, config)) {
        resultado.aguardandoBackoff.push(run.id);
      } else {
        elegiveis.push(run);
      }
    }

    // 3. Motor sobre o subconjunto elegível.
    const missoes = await ctx.repo.listarMissoes(organizacao.id);
    const aprovacoes = await ctx.repo.listarAprovacoes(organizacao.id);
    const aprovadas = new Set(aprovacoes.filter((a) => a.decisao === "aprovado" && a.runId).map((a) => a.runId as string));
    const passo = processar({ runs: elegiveis, missoes, config, agora, aprovadas });

    // 4. Persistência + leases das execuções iniciadas.
    for (const run of passo.runs) {
      const anterior = aposRecuperacao.find((r) => r.id === run.id);
      if (anterior?.status !== run.status) await ctx.repo.salvarRun(run);
    }
    for (const id of passo.iniciados) {
      leases.adquirir(id);
    }
    for (const id of passo.expirados) {
      leases.liberar(id);
    }

    resultado.iniciados.push(...passo.iniciados);
    resultado.expirados.push(...passo.expirados);
    resultado.mensagens.push(...passo.mensagens);
  }

  // Higiene: libera leases de execuções que já terminaram.
  for (const lease of leases.ativos()) {
    const run = await buscarRunGlobal(ctx, lease.runId);
    if (!run || (run.status !== "executando" && run.status !== "enfileirada")) leases.liberar(lease.runId);
  }

  return resultado;
}

async function buscarRunGlobal(ctx: Contexto, runId: string): Promise<MissionRun | null> {
  const organizacoes = await ctx.repo.listarOrganizacoes();
  for (const organizacao of organizacoes) {
    const run = await ctx.repo.buscarRun(organizacao.id, runId);
    if (run) return run;
  }
  return null;
}
