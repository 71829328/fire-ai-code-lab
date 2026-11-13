import { describe, expect, it } from "vitest";
import {
  LIMITES_PADRAO,
  criticidadeDaOperacao,
  estimarCustoExcedido,
  exigirAprovacaoHumana,
  permitirGasto,
  permitirOperacaoExterna,
  verificarLimitesExecucao,
} from "./guards";
import type { MissionRun } from "../orchestration/types";

function run(overrides: Partial<MissionRun> = {}): MissionRun {
  return {
    id: "run-1",
    organizacaoId: "org-1",
    missaoId: "ms-1",
    missaoCodigo: "MSN-0001",
    agenteId: null,
    prioridade: "media",
    criticidade: "normal",
    status: "enfileirada",
    chaveIdempotencia: "k",
    tentativaAtual: 0,
    tentativas: [],
    eventos: [],
    criadoEm: "2026-01-01T00:00:00.000Z",
    atualizadoEm: "2026-01-01T00:00:00.000Z",
    iniciadoEm: null,
    finalizadoEm: null,
    resultado: null,
    erro: null,
    ...overrides,
  };
}

describe("guards — operações externas e gastos bloqueados por padrão", () => {
  it("bloqueia operação externa sem autorização", () => {
    const r = permitirOperacaoExterna();
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/bloqueada/i);
  });

  it("bloqueia operação externa mesmo com flag marcada mas sem autorização explícita", () => {
    const r = permitirOperacaoExterna({ ...LIMITES_PADRAO, operacoesExternasPermitidas: true }, false);
    expect(r.permitido).toBe(false);
  });

  it("permite somente com autorização explícita e flag habilitada", () => {
    const r = permitirOperacaoExterna({ ...LIMITES_PADRAO, operacoesExternasPermitidas: true }, true);
    expect(r.permitido).toBe(true);
  });

  it("gasto permanece bloqueado na configuração padrão", () => {
    expect(permitirGasto().permitido).toBe(false);
    expect(permitirGasto({ ...LIMITES_PADRAO, gastoPermitido: true }).permitido).toBe(true);
  });
});

describe("guards — limites de execução", () => {
  it("bloqueia quando a fila ultrapassa o limite seguro", () => {
    const runs = Array.from({ length: LIMITES_PADRAO.maxConcorrentes * 10 }, (_, i) =>
      run({ id: `run-${i}` })
    );
    const r = verificarLimitesExecucao(runs, "ms-nova");
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/Fila/);
  });

  it("bloqueia quando a missão já atingiu o máximo de execuções", () => {
    const runs = Array.from({ length: LIMITES_PADRAO.maxExecucoesPorMissao }, (_, i) =>
      run({ id: `run-${i}`, missaoId: "ms-1" })
    );
    const r = verificarLimitesExecucao(runs, "ms-1");
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/execuções por missão/);
  });

  it("permite quando dentro dos limites", () => {
    const r = verificarLimitesExecucao([run()], "ms-2");
    expect(r.permitido).toBe(true);
  });
});

describe("guards — política de aprovação humana", () => {
  it("exige aprovação para operações críticas e não para execução local", () => {
    expect(exigirAprovacaoHumana("deploy")).toBe(true);
    expect(exigirAprovacaoHumana("execucao_externa")).toBe(true);
    expect(exigirAprovacaoHumana("exclusao_massa")).toBe(true);
    expect(exigirAprovacaoHumana("execucao_local")).toBe(false);
  });

  it("deriva criticidade da operação", () => {
    expect(criticidadeDaOperacao("deploy")).toBe("critica");
    expect(criticidadeDaOperacao("execucao_local")).toBe("normal");
  });
});

describe("guards — teto de custo informativo", () => {
  it("bloqueia quando não há teto definido", () => {
    const r = estimarCustoExcedido(0, 0);
    expect(r.permitido).toBe(false);
    expect(r.motivo).toMatch(/teto/i);
  });

  it("bloqueia quando o custo acumulado atinge o teto", () => {
    expect(estimarCustoExcedido(100, 100).permitido).toBe(false);
    expect(estimarCustoExcedido(150, 100).permitido).toBe(false);
  });

  it("permite quando dentro do teto", () => {
    expect(estimarCustoExcedido(50, 100).permitido).toBe(true);
  });
});
