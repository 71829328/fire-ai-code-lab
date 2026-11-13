import { describe, expect, it } from "vitest";
import {
  cancelar,
  concluir,
  criarRun,
  emExecucao,
  enfileirar,
  falhar,
  filaOrdenada,
  iniciar,
  dependenciasSatisfeitas,
  missionParaView,
  processar,
  resolverAprovacao,
} from "./engine";
import { ehTerminal, podeTransicionar, transicoesPermitidas } from "./stateMachine";
import { DEFAULT_ENGINE_CONFIG, type MissionView, type MissionRun } from "./types";
import type { Mission } from "../types";

const T0 = "2026-01-01T00:00:00.000Z";
const T1 = "2026-01-01T00:00:10.000Z";

function view(overrides: Partial<MissionView> = {}): MissionView {
  return {
    id: "ms-1",
    codigo: "MSN-0001",
    titulo: "Missão",
    prioridade: "media",
    status: "pendente",
    dependencias: [],
    agenteId: "ag-1",
    instrucoes: "fazer",
    criteriosAceite: [],
    ...overrides,
  };
}

let seq = 0;
function run(overrides: Partial<Parameters<typeof criarRun>[0]> = {}): MissionRun {
  seq += 1;
  return criarRun({
    organizacaoId: "org-demo",
    missao: view(),
    agora: T0,
    id: `run-${seq}`,
    ...overrides,
  });
}

describe("stateMachine — transições explícitas", () => {
  it("estados terminais não aceitam novas transições de fluxo", () => {
    expect(ehTerminal("concluida")).toBe(true);
    expect(ehTerminal("falhou")).toBe(true);
    expect(ehTerminal("cancelada")).toBe(true);
    expect(ehTerminal("expirada")).toBe(true);
    expect(ehTerminal("enfileirada")).toBe(false);
    expect(ehTerminal("executando")).toBe(false);
  });

  it("rejeita transições impossíveis", () => {
    expect(podeTransicionar("concluida", "executando")).toBe(false);
    expect(podeTransicionar("enfileirada", "concluida")).toBe(false);
    expect(podeTransicionar("enfileirada", "executando")).toBe(true);
    expect(podeTransicionar("executando", "concluida")).toBe(true);
  });

  it("permite permanência no mesmo estado e expõe transições permitidas", () => {
    expect(podeTransicionar("executando", "executando")).toBe(true);
    expect(transicoesPermitidas("concluida")).toEqual([]);
    expect(transicoesPermitidas("enfileirada")).toContain("executando");
  });
});

describe("criarRun / enfileirar — idempotência", () => {
  it("criarRun inicia enfileirada com chave idempotente por organização+missão", () => {
    const r = run({ missao: view({ id: "ms-42" }) });
    expect(r.status).toBe("enfileirada");
    expect(r.chaveIdempotencia).toBe("org-demo:ms-42");
    expect(r.eventos[0].status).toBe("enfileirada");
  });

  it("não cria uma segunda execução não terminal com a mesma chave", () => {
    const r = run();
    const primeira = enfileirar([], r);
    expect(primeira.criado).toBe(true);
    expect(primeira.runs).toHaveLength(1);

    const segunda = enfileirar(primeira.runs, { ...r, id: "run-outro" });
    expect(segunda.criado).toBe(false);
    expect(segunda.existenteId).toBe(r.id);
    expect(segunda.runs).toHaveLength(1);
  });

  it("permite nova execução quando a anterior é terminal", () => {
    const r = run();
    const enfileirada = enfileirar([], r).runs;
    const terminada = enfileirada.map((x) =>
      concluir(iniciar(x, T0), { resumo: "", checksum: "", verificacao: { passou: true, detalhe: "" } }, T1)
    );
    const nova = enfileirar(terminada, { ...r, id: "run-nova" });
    expect(nova.criado).toBe(true);
    expect(nova.runs).toHaveLength(2);
  });
});

describe("filaOrdenada — prioridade e justiça", () => {
  it("ordena por prioridade e, em empate, pela criação mais antiga", () => {
    const alta = run({ missao: view({ id: "a", prioridade: "alta" }), agora: T1 });
    const mediaAntiga = run({ missao: view({ id: "b", prioridade: "media" }), agora: T0 });
    const mediaNova = run({ missao: view({ id: "c", prioridade: "media" }), agora: T1 });
    const baixa = run({ missao: view({ id: "d", prioridade: "baixa" }), agora: T0 });

    const fila = filaOrdenada([baixa, mediaNova, alta, mediaAntiga]);
    expect(fila.map((r) => r.missaoId)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("dependenciasSatisfeitas", () => {
  it("retorna false quando a dependência não está concluída", () => {
    const missoes = [view({ id: "A", status: "pendente" }), view({ id: "B", dependencias: ["A"] })];
    const r = run({ missao: missoes[1] });
    expect(dependenciasSatisfeitas(r, missoes)).toBe(false);
  });

  it("retorna true quando a dependência está concluída", () => {
    const missoes = [view({ id: "A", status: "concluida" }), view({ id: "B", dependencias: ["A"] })];
    const r = run({ missao: missoes[1] });
    expect(dependenciasSatisfeitas(r, missoes)).toBe(true);
  });

  it("retorna true quando não há dependências", () => {
    expect(dependenciasSatisfeitas(run(), [view()])).toBe(true);
  });
});

describe("processar — concorrência", () => {
  it("inicia no máximo o número de vagas configurado", () => {
    const runs = [
      run({ missao: view({ id: "m1" }) }),
      run({ missao: view({ id: "m2" }) }),
      run({ missao: view({ id: "m3" }) }),
      run({ missao: view({ id: "m4" }) }),
    ];
    const passo = processar({
      runs,
      missoes: runs.map((r) => view({ id: r.missaoId })),
      config: { ...DEFAULT_ENGINE_CONFIG, maxConcorrencia: 2 },
      agora: T1,
    });
    expect(passo.iniciados).toHaveLength(2);
    expect(emExecucao(passo.runs)).toHaveLength(2);
    expect(passo.runs.filter((r) => r.status === "enfileirada")).toHaveLength(2);
  });
});

describe("processar — dependências", () => {
  it("não inicia missão cuja dependência não está concluída", () => {
    const missoes = [view({ id: "A", status: "pendente" }), view({ id: "B", dependencias: ["A"] })];
    const r = run({ missao: missoes[1] });
    const passo = processar({ runs: [r], missoes, agora: T1 });
    const atualizado = passo.runs.find((x) => x.id === r.id);
    expect(atualizado?.status).toBe("aguardando_dependencia");
    expect(passo.iniciados).not.toContain(r.id);
  });

  it("retorna à fila e inicia quando a dependência é concluída", () => {
    const bloqueada: MissionRun = run({ missao: view({ id: "B", dependencias: ["A"] }) });
    // Primeiro passo: vira aguardando_dependencia.
    const p1 = processar({
      runs: [bloqueada],
      missoes: [view({ id: "A", status: "pendente" }), view({ id: "B", dependencias: ["A"] })],
      agora: T1,
    });
    expect(p1.runs[0].status).toBe("aguardando_dependencia");

    // Dependência concluída → volta à fila e inicia.
    const p2 = processar({
      runs: p1.runs,
      missoes: [view({ id: "A", status: "concluida" }), view({ id: "B", dependencias: ["A"] })],
      agora: T1,
    });
    expect(p2.runs[0].status).toBe("executando");
    expect(p2.iniciados).toContain(bloqueada.id);
  });
});

describe("processar — aprovação humana de operações críticas", () => {
  it("trava execução crítica em aguardando_aprovacao sem aprovação", () => {
    const r = run({ criticidade: "critica" });
    const passo = processar({ runs: [r], missoes: [view()], agora: T1 });
    expect(passo.runs[0].status).toBe("aguardando_aprovacao");
    expect(passo.mensagens.join(" ")).toMatch(/aprovação humana/);
  });

  it("inicia execução crítica após aprovação explícita", () => {
    const r = run({ criticidade: "critica" });
    const travada = processar({ runs: [r], missoes: [view()], agora: T1 }).runs[0];
    expect(travada.status).toBe("aguardando_aprovacao");

    const liberada = resolverAprovacao(travada, true, T1, "ok");
    expect(liberada.status).toBe("enfileirada");

    const passo = processar({
      runs: [liberada],
      missoes: [view()],
      agora: T1,
      aprovadas: new Set([r.id]),
    });
    expect(passo.runs[0].status).toBe("executando");
  });

  it("resolverAprovacao com rejeição cancela a execução", () => {
    const r = run({ criticidade: "critica" });
    const travada = processar({ runs: [r], missoes: [view()], agora: T1 }).runs[0];
    const negada = resolverAprovacao(travada, false, T1, "risco");
    expect(negada.status).toBe("cancelada");
  });
});

describe("processar — timeout e retentativa", () => {
  it("expira definitivamente quando não há tentativas restantes", () => {
    const r = iniciar(run(), T0);
    const passo = processar({
      runs: [r],
      missoes: [view()],
      config: { ...DEFAULT_ENGINE_CONFIG, timeoutMs: 1000, maxTentativas: 1, maxConcorrencia: 0 },
      agora: "2026-01-01T00:00:05.000Z",
    });
    expect(passo.expirados).toContain(r.id);
    expect(passo.runs[0].status).toBe("expirada");
  });

  it("reagenda para nova tentativa quando ainda há tentativas", () => {
    const r = iniciar(run(), T0);
    const passo = processar({
      runs: [r],
      missoes: [view()],
      config: { ...DEFAULT_ENGINE_CONFIG, timeoutMs: 1000, maxTentativas: 3, maxConcorrencia: 0 },
      agora: "2026-01-01T00:00:05.000Z",
    });
    expect(passo.expirados).toContain(r.id);
    expect(passo.runs[0].status).toBe("enfileirada");
  });
});

describe("falhar — retentativa controlada", () => {
  it("reagenda enquanto houver tentativas disponíveis", () => {
    const r = iniciar(run(), T0);
    const reagendada = falhar(r, "erro", T1, { ...DEFAULT_ENGINE_CONFIG, maxTentativas: 3 });
    expect(reagendada.status).toBe("enfileirada");
    expect(reagendada.erro).toBe("erro");
  });

  it("encerra como falhou quando esgota as tentativas", () => {
    let r = iniciar(run(), T0);
    r = falhar(r, "e1", T0, { ...DEFAULT_ENGINE_CONFIG, maxTentativas: 3 });
    r = iniciar(r, T0);
    r = falhar(r, "e2", T0, { ...DEFAULT_ENGINE_CONFIG, maxTentativas: 3 });
    r = iniciar(r, T0);
    r = falhar(r, "e3", T0, { ...DEFAULT_ENGINE_CONFIG, maxTentativas: 3 });
    expect(r.status).toBe("falhou");
    expect(r.tentativas).toHaveLength(3);
  });
});

describe("cancelar", () => {
  it("cancela uma execução ativa", () => {
    const r = run();
    expect(cancelar(r, T1).status).toBe("cancelada");
  });

  it("não altera uma execução já terminal", () => {
    const r = concluir(
      iniciar(run(), T0),
      { resumo: "", checksum: "", verificacao: { passou: true, detalhe: "" } },
      T1
    );
    expect(cancelar(r, T1).status).toBe("concluida");
  });
});

describe("missionParaView", () => {
  it("projeta apenas os campos exigidos pelo motor", () => {
    const missao: Mission = {
      id: "ms-9",
      codigo: "MSN-0009",
      titulo: "T",
      objetivo: "O",
      instrucoes: "I",
      prioridade: "alta",
      criteriosAceite: ["c1"],
      agenteId: "ag-9",
      projetoId: null,
      dependencias: ["ms-1"],
      status: "pendente",
      origem: "cadastrado",
      evidencias: [],
      historico: [],
      criadoEm: T0,
      atualizadoEm: T0,
    };
    const v = missionParaView(missao);
    expect(v).toEqual({
      id: "ms-9",
      codigo: "MSN-0009",
      titulo: "T",
      prioridade: "alta",
      status: "pendente",
      dependencias: ["ms-1"],
      agenteId: "ag-9",
      instrucoes: "I",
      criteriosAceite: ["c1"],
    });
  });
});
