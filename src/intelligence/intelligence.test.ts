import { describe, expect, it } from "vitest";
import {
  calcularEspecialidades,
  calcularMetricasAgente,
  calcularMetricasTodos,
} from "./metrics";
import { melhorRecomendacao, recomendarAgentes } from "./recommendation";
import type { MissionRun, RunAttempt } from "../orchestration/types";
import type { EvidenceRecord, UsageMetric } from "../platform/types";

const AGORA = "2026-01-01T00:00:00.000Z";

function tentativa(numero: number, status: RunAttempt["status"]): RunAttempt {
  return {
    numero,
    inicio: AGORA,
    fim: "2026-01-01T00:00:01.000Z",
    status,
    erro: null,
    resultado: null,
  };
}

function run({ agenteId, ...overrides }: Partial<MissionRun> & { agenteId: string | null }): MissionRun {
  return {
    id: "run-1",
    organizacaoId: "org-1",
    missaoId: "ms-1",
    missaoCodigo: "MSN-0001",
    agenteId,
    prioridade: "media",
    criticidade: "normal",
    status: "concluida",
    chaveIdempotencia: "k-1",
    tentativaAtual: 1,
    tentativas: [],
    eventos: [],
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:10.000Z",
    iniciadoEm: "2026-01-01T00:00:00.000Z",
    finalizadoEm: "2026-01-01T00:00:10.000Z",
    resultado: null,
    erro: null,
    ...overrides,
  };
}

function evidencia(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "ev-1",
    organizacaoId: "org-1",
    missaoId: "ms-1",
    runId: null,
    tipo: "teste",
    referencia: "suite",
    descricao: "",
    valor: "",
    origemDado: "informado_agente",
    registradoPor: null,
    verificadoPor: null,
    verificadoEm: null,
    timestamp: AGORA,
    ...overrides,
  };
}

function consumo(agenteId: string | null, quantidade: number): UsageMetric {
  return {
    id: `c-${agenteId}-${quantidade}`,
    organizacaoId: "org-1",
    provedorId: "trae",
    agenteId,
    missaoId: null,
    runId: null,
    unidade: "tokens",
    quantidade,
    custoEstimado: 0,
    moeda: "BRL",
    origemDado: "informado_operador",
    timestamp: AGORA,
  };
}

describe("métricas — sem dados", () => {
  it("retorna taxaSucesso/tempoMedioMs null e listas vazias sem execuções", () => {
    const m = calcularMetricasAgente({ agenteId: "a1", runs: [], evidencias: [], consumo: [] });
    expect(m.missoesConcluidas).toBe(0);
    expect(m.missoesFalhadas).toBe(0);
    expect(m.taxaSucesso).toBeNull();
    expect(m.tempoMedioMs).toBeNull();
    expect(m.especialidades).toEqual([]);
  });
});

describe("métricas — cálculo real com runs mínimos", () => {
  it("conta concluídas/falhadas, calcula taxa de sucesso e tempo médio", () => {
    const runs = [
      run({ id: "r1", agenteId: "a1", status: "concluida", finalizadoEm: "2026-01-01T00:00:10.000Z" }),
      run({ id: "r2", agenteId: "a1", status: "concluida", finalizadoEm: "2026-01-01T00:00:20.000Z" }),
      run({ id: "r3", agenteId: "a1", status: "falhou" }),
      run({ id: "r4", agenteId: "a1", status: "expirada" }),
      run({ id: "r5", agenteId: "a2", status: "concluida" }),
    ];
    const m = calcularMetricasAgente({ agenteId: "a1", runs, evidencias: [], consumo: [] });
    expect(m.missoesConcluidas).toBe(2);
    expect(m.missoesFalhadas).toBe(2);
    expect(m.taxaSucesso).toBeCloseTo(0.5);
    expect(m.tempoMedioMs).toBe(15000);
  });

  it("conta erros a partir das tentativas com falha/timeout", () => {
    const runs = [
      run({
        id: "r1",
        agenteId: "a1",
        tentativas: [tentativa(1, "falha"), tentativa(2, "timeout"), tentativa(3, "sucesso")],
      }),
    ];
    const m = calcularMetricasAgente({ agenteId: "a1", runs, evidencias: [], consumo: [] });
    expect(m.erros).toBe(2);
  });

  it("calcula retrabalho como runs com mais de uma tentativa", () => {
    const runs = [
      run({ id: "r1", agenteId: "a1", tentativas: [tentativa(1, "falha"), tentativa(2, "sucesso")] }),
      run({ id: "r2", agenteId: "a1", tentativas: [tentativa(1, "sucesso")] }),
    ];
    const m = calcularMetricasAgente({ agenteId: "a1", runs, evidencias: [], consumo: [] });
    expect(m.retrabalho).toBe(1);
  });

  it("conta testes aprovados apenas em evidências do tipo teste do agente", () => {
    const runs = [run({ id: "r1", agenteId: "a1" })];
    const evidencias = [
      evidencia({ id: "ev-1", runId: "r1", tipo: "teste", valor: "APROVADO" }),
      evidencia({ id: "ev-2", runId: "r1", tipo: "teste", descricao: "suite aprovada" }),
      evidencia({ id: "ev-3", runId: "r1", tipo: "teste", valor: "falhou" }),
      evidencia({ id: "ev-4", runId: "r1", tipo: "commit", valor: "aprovado" }),
    ];
    const m = calcularMetricasAgente({ agenteId: "a1", runs, evidencias, consumo: [] });
    expect(m.testesAprovados).toBe(2);
  });

  it("soma o consumo informado apenas do agente", () => {
    const m = calcularMetricasAgente({
      agenteId: "a1",
      runs: [],
      evidencias: [],
      consumo: [consumo("a1", 100), consumo("a1", 50), consumo("a2", 999)],
    });
    expect(m.consumoInformado).toBe(150);
  });

  it("calcularMetricasTodos agrega por agente", () => {
    const runs = [run({ id: "r1", agenteId: "a1", status: "concluida" })];
    const todos = calcularMetricasTodos({
      agentes: [
        { id: "a1", nome: "Alfa" },
        { id: "a2", nome: "Beta" },
      ],
      runs,
      evidencias: [],
      consumo: [],
    });
    expect(todos).toHaveLength(2);
    expect(todos[0].metricas.missoesConcluidas).toBe(1);
    expect(todos[1].metricas.taxaSucesso).toBeNull();
  });
});

describe("especialidades — nunca fabricar", () => {
  it("retorna [] quando não há evidências verificadas", () => {
    expect(calcularEspecialidades([evidencia({ id: "ev-1", tipo: "commit" })])).toEqual([]);
  });

  it("deriva tipos apenas das evidências verificadas independentemente", () => {
    const especialidades = calcularEspecialidades([
      evidencia({ id: "ev-1", tipo: "deployment", origemDado: "verificado_independente" }),
      evidencia({ id: "ev-2", tipo: "teste", origemDado: "verificado_independente" }),
      evidencia({ id: "ev-3", tipo: "commit", origemDado: "informado_agente" }),
    ]);
    expect(especialidades).toEqual(["deployment", "teste"]);
  });
});

describe("recomendação — só com dados observados", () => {
  it("marca sem_dados e pontuação 0 para agente sem runs", () => {
    const recs = recomendarAgentes({
      agentes: [{ id: "a1", nome: "Alfa", papel: "dev", conexao: "desconectado" }],
      runs: [],
      evidencias: [],
      consumo: [],
    });
    expect(recs).toHaveLength(1);
    expect(recs[0].confianca).toBe("sem_dados");
    expect(recs[0].pontuacao).toBe(0);
    expect(recs[0].justificativa).toMatch(/Sem execuções/);
  });

  it("pontua acima quem tem bons dados reais e ordena primeiro", () => {
    const runs = [
      run({ id: "r1", agenteId: "a1", status: "concluida", finalizadoEm: "2026-01-01T00:00:10.000Z" }),
      run({ id: "r2", agenteId: "a1", status: "concluida", finalizadoEm: "2026-01-01T00:00:10.000Z" }),
      run({ id: "r3", agenteId: "a1", status: "concluida", finalizadoEm: "2026-01-01T00:00:10.000Z" }),
    ];
    const evidencias = [evidencia({ id: "ev-1", runId: "r1", tipo: "teste", valor: "aprovado" })];
    const recs = recomendarAgentes({
      agentes: [
        { id: "a1", nome: "Alfa", papel: "dev", conexao: "desconectado" },
        { id: "a2", nome: "Beta", papel: "dev", conexao: "desconectado" },
      ],
      runs,
      evidencias,
      consumo: [],
    });
    expect(recs[0].agenteId).toBe("a1");
    expect(recs[0].pontuacao).toBeGreaterThan(0);
    expect(recs[0].confianca).not.toBe("sem_dados");
    expect(recs[0].justificativa).toMatch(/sucesso/);
    expect(recs[1].agenteId).toBe("a2");
    expect(recs[1].confianca).toBe("sem_dados");
    expect(recs[1].pontuacao).toBe(0);

    const melhor = melhorRecomendacao({
      agentes: [
        { id: "a1", nome: "Alfa", papel: "dev", conexao: "desconectado" },
        { id: "a2", nome: "Beta", papel: "dev", conexao: "desconectado" },
      ],
      runs,
      evidencias,
      consumo: [],
    });
    expect(melhor?.agenteId).toBe("a1");
  });

  it("melhorRecomendacao retorna null quando todos estão sem dados", () => {
    const melhor = melhorRecomendacao({
      agentes: [{ id: "a1", nome: "Alfa", papel: "dev", conexao: "desconectado" }],
      runs: [],
      evidencias: [],
      consumo: [],
    });
    expect(melhor).toBeNull();
  });
});
