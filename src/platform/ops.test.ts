import { describe, expect, it } from "vitest";
import {
  createOpsSeed,
  opsReducer,
  podeFazer,
  prepararRunDeMissao,
  usuarioAtivo,
  type OpsState,
} from "./ops";
import { criarRun } from "../orchestration/engine";
import type { MissionRun } from "../orchestration/types";
import type { EvidenceRecord } from "./types";
import type { Mission } from "../types";

const T0 = "2026-01-01T00:00:00.000Z";

function seed(): OpsState {
  return createOpsSeed();
}

function runDeMissao(org: string, missaoId = "ms-nova"): MissionRun {
  return criarRun({
    organizacaoId: org,
    missao: {
      id: missaoId,
      codigo: `MSN-${missaoId}`,
      titulo: "Nova",
      prioridade: "media",
      status: "pendente",
      dependencias: [],
      agenteId: "ag-1",
      instrucoes: "x",
      criteriosAceite: [],
    },
    agora: T0,
  });
}

const evidenciaBase: Omit<EvidenceRecord, "id" | "organizacaoId" | "timestamp"> = {
  missaoId: null,
  runId: null,
  tipo: "commit",
  referencia: "abc123",
  descricao: "commit inicial",
  valor: "",
  origemDado: "informado_agente",
  registradoPor: null,
  verificadoPor: null,
  verificadoEm: null,
};

describe("ops — usuário ativo e permissões", () => {
  it("a semente inicia com o proprietário ativo e permissão de execução", () => {
    const state = seed();
    expect(usuarioAtivo(state)?.papel).toBe("proprietario");
    expect(usuarioAtivo(state)?.id).toBe("us-owner");
    expect(podeFazer(state, "missao:executar")).toBe(true);
  });

  it("trocar o usuário ativo para observador retira a permissão de execução", () => {
    const state = opsReducer(seed(), { type: "usuario/ativar", payload: { id: "us-obs" } });
    expect(usuarioAtivo(state)?.papel).toBe("observador");
    expect(podeFazer(state, "missao:executar")).toBe(false);
    expect(podeFazer(state, "auditoria:ler")).toBe(true);
  });

  it("não troca para usuário de outra organização", () => {
    const state = opsReducer(seed(), { type: "usuario/ativar", payload: { id: "us-inexistente" } });
    expect(state.platform.usuarioAtivoId).toBe("us-owner");
  });
});

describe("ops — auditoria por mutação", () => {
  it("ativar organização registra auditoria e redefine o usuário ativo", () => {
    const state = opsReducer(seed(), { type: "organizacao/ativar", payload: { id: "org-lab" } });
    expect(state.platform.organizacaoAtivaId).toBe("org-lab");
    expect(state.platform.auditoria).toHaveLength(1);
    expect(state.platform.auditoria[0].acao).toMatch(/organização/);
  });

  it("registrar consumo adiciona métrica e audita", () => {
    const state = opsReducer(seed(), {
      type: "consumo/registrar",
      payload: {
        provedorId: "trae",
        agenteId: "ag-1",
        missaoId: null,
        runId: null,
        unidade: "tokens",
        quantidade: 100,
        custoEstimado: 0,
        moeda: "BRL",
        origemDado: "informado_operador",
      },
    });
    expect(state.platform.consumo).toHaveLength(1);
    expect(state.platform.consumo[0].organizacaoId).toBe("org-demo");
    expect(state.platform.auditoria[0].recurso).toBe("consumo");
  });
});

describe("ops — isolamento de organização", () => {
  it("organização sem usuários não permite executar e nega o enfileiramento", () => {
    const semUsuario = opsReducer(seed(), { type: "organizacao/ativar", payload: { id: "org-lab" } });
    expect(usuarioAtivo(semUsuario)).toBeNull();
    expect(podeFazer(semUsuario, "missao:executar")).toBe(false);

    const negado = opsReducer(semUsuario, {
      type: "run/enfileirar",
      payload: { run: runDeMissao("org-lab"), permissao: "missao:executar" },
    });
    expect(negado.runs).toHaveLength(0);
    expect(negado.platform.auditoria[0].resultado).toBe("negado");
  });
});

describe("ops — enfileiramento e idempotência", () => {
  it("enfileira com permissão e audita", () => {
    const run = runDeMissao("org-demo");
    const state = opsReducer(seed(), {
      type: "run/enfileirar",
      payload: { run, permissao: "missao:executar" },
    });
    expect(state.runs).toHaveLength(1);
    expect(state.platform.auditoria[0].resultado).toBe("permitido");
  });

  it("segundo enfileiramento com a mesma chave é ignorado por idempotência", () => {
    const run = runDeMissao("org-demo");
    const primeiro = opsReducer(seed(), {
      type: "run/enfileirar",
      payload: { run, permissao: "missao:executar" },
    });
    const segundo = opsReducer(primeiro, {
      type: "run/enfileirar",
      payload: { run: { ...run, id: "run-duplicado" }, permissao: "missao:executar" },
    });
    expect(segundo.runs).toHaveLength(1);
    expect(segundo.platform.auditoria[0].detalhe).toMatch(/idempotência/i);
    expect(segundo.platform.auditoria[0].resultado).toBe("info");
  });

  it("observador não pode enfileirar execução", () => {
    const comoObservador = opsReducer(seed(), { type: "usuario/ativar", payload: { id: "us-obs" } });
    const state = opsReducer(comoObservador, {
      type: "run/enfileirar",
      payload: { run: runDeMissao("org-demo"), permissao: "missao:executar" },
    });
    expect(state.runs).toHaveLength(0);
    expect(state.platform.auditoria[0].resultado).toBe("negado");
  });
});

describe("ops — central de evidências", () => {
  it("operador registra evidência como informado_agente", () => {
    const comoOperador = opsReducer(seed(), { type: "usuario/ativar", payload: { id: "us-op" } });
    const state = opsReducer(comoOperador, { type: "evidencia/adicionar", payload: evidenciaBase });
    expect(state.platform.evidencias).toHaveLength(1);
    expect(state.platform.evidencias[0].origemDado).toBe("informado_agente");
    expect(state.platform.evidencias[0].organizacaoId).toBe("org-demo");
    expect(state.platform.evidencias[0].registradoPor).toBe("us-op");
  });

  it("observador não pode registrar evidência", () => {
    const comoObservador = opsReducer(seed(), { type: "usuario/ativar", payload: { id: "us-obs" } });
    const state = opsReducer(comoObservador, { type: "evidencia/adicionar", payload: evidenciaBase });
    expect(state.platform.evidencias).toHaveLength(0);
    expect(state.platform.auditoria[0].resultado).toBe("negado");
  });

  it("promove a verificada apenas com verificador identificado", () => {
    const comEvidencia = opsReducer(seed(), { type: "evidencia/adicionar", payload: evidenciaBase });
    const id = comEvidencia.platform.evidencias[0].id;
    const state = opsReducer(comEvidencia, {
      type: "evidencia/verificar",
      payload: { id, verificador: "auditor.cto" },
    });
    expect(state.platform.evidencias[0].origemDado).toBe("verificado_independente");
    expect(state.platform.evidencias[0].verificadoPor).toBe("auditor.cto");
  });

  it("verificação sem verificador é rejeitada", () => {
    const comEvidencia = opsReducer(seed(), { type: "evidencia/adicionar", payload: evidenciaBase });
    const id = comEvidencia.platform.evidencias[0].id;
    expect(() =>
      opsReducer(comEvidencia, { type: "evidencia/verificar", payload: { id, verificador: "  " } })
    ).toThrow("Verificador obrigatório");
  });
});

describe("ops — reset e preparação de execução", () => {
  it("estado/resetar restaura a semente", () => {
    const alterado = opsReducer(seed(), { type: "organizacao/ativar", payload: { id: "org-lab" } });
    const resetado = opsReducer(alterado, { type: "estado/resetar" });
    expect(resetado.platform.organizacaoAtivaId).toBe("org-demo");
    expect(resetado.runs).toHaveLength(0);
    expect(resetado.platform.auditoria).toHaveLength(0);
  });

  it("prepararRunDeMissao usa a organização ativa", () => {
    const missao: Mission = {
      id: "ms-1",
      codigo: "MSN-0001",
      titulo: "T",
      objetivo: "O",
      instrucoes: "I",
      prioridade: "alta",
      criteriosAceite: [],
      agenteId: "ag-1",
      projetoId: null,
      dependencias: [],
      status: "pendente",
      origem: "cadastrado",
      evidencias: [],
      historico: [],
      criadoEm: T0,
      atualizadoEm: T0,
    };
    const { run, params } = prepararRunDeMissao(seed(), missao, "critica");
    expect(run.organizacaoId).toBe("org-demo");
    expect(run.criticidade).toBe("critica");
    expect(params.organizacaoId).toBe("org-demo");
  });
});
