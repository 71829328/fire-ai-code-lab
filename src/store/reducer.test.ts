import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./reducer";
import { computeStats, statusDistribution, tasksByAgent } from "./selectors";

const baseAgent = {
  nome: "Teste",
  papel: "Analista",
  status: "ativo" as const,
  modelo: "FIRE-Core 3",
  proficiencia: 80,
  tarefasConcluidas: 0,
  descricao: "Agente de teste",
};

describe("reducer — agentes", () => {
  it("cadastra um agente marcando-o como não demonstrativo", () => {
    const state = reducer(initialState(), { type: "agente/criar", payload: baseAgent });
    const criado = state.agentes[0];
    expect(criado.nome).toBe("Teste");
    expect(criado.demo).toBe(false);
    expect(criado.id).toMatch(/^ag-/);
    expect(state.atividades[0].tipo).toBe("agente");
  });

  it("preserva a flag demo ao atualizar um agente demonstrativo", () => {
    const inicial = initialState();
    const alvo = inicial.agentes[0];
    const state = reducer(inicial, {
      type: "agente/atualizar",
      payload: { ...alvo, nome: "Renomeado" },
    });
    const atualizado = state.agentes.find((a) => a.id === alvo.id)!;
    expect(atualizado.nome).toBe("Renomeado");
    expect(atualizado.demo).toBe(true);
  });

  it("desvincula referências ao remover um agente", () => {
    const inicial = initialState();
    const alvo = inicial.agentes.find((a) => a.id === "ag-001")!;
    const state = reducer(inicial, { type: "agente/remover", payload: { id: alvo.id } });
    expect(state.agentes.some((a) => a.id === alvo.id)).toBe(false);
    expect(state.tarefas.every((t) => t.agenteId !== alvo.id)).toBe(true);
    expect(state.projetos.every((p) => p.responsavelId !== alvo.id)).toBe(true);
  });
});

describe("reducer — tarefas", () => {
  it("cria tarefa não demonstrativa com id gerado", () => {
    const state = reducer(initialState(), {
      type: "tarefa/criar",
      payload: {
        titulo: "Nova tarefa",
        descricao: "Descrição",
        status: "pendente",
        prioridade: "alta",
        projetoId: null,
        agenteId: null,
        ordem: 0,
      },
    });
    expect(state.tarefas[0].titulo).toBe("Nova tarefa");
    expect(state.tarefas[0].demo).toBe(false);
  });

  it("move a tarefa para o novo status e registra atividade", () => {
    const inicial = initialState();
    const alvo = inicial.tarefas.find((t) => t.status === "pendente")!;
    const state = reducer(inicial, {
      type: "tarefa/mover",
      payload: { id: alvo.id, status: "concluida", ordem: 0 },
    });
    const movida = state.tarefas.find((t) => t.id === alvo.id)!;
    expect(movida.status).toBe("concluida");
    expect(state.atividades[0].tipo).toBe("tarefa");
    expect(state.atividades[0].acao).toContain("moveu");
  });

  it("não altera o estado ao mover para o mesmo status", () => {
    const inicial = initialState();
    const alvo = inicial.tarefas[0];
    const state = reducer(inicial, {
      type: "tarefa/mover",
      payload: { id: alvo.id, status: alvo.status, ordem: alvo.ordem },
    });
    expect(state).toBe(inicial);
  });
});

describe("reducer — reset", () => {
  it("restaura o conjunto demonstrativo", () => {
    const alterado = reducer(initialState(), {
      type: "agente/criar",
      payload: baseAgent,
    });
    const restaurado = reducer(alterado, { type: "estado/resetar" });
    expect(restaurado.agentes).toHaveLength(5);
    expect(restaurado.agentes.every((a) => a.demo)).toBe(true);
  });
});

describe("selectors", () => {
  it("calcula estatísticas coerentes", () => {
    const stats = computeStats(initialState());
    expect(stats.totalTarefas).toBe(
      stats.tarefasPendentes + stats.tarefasEmExecucao + stats.tarefasConcluidas
    );
    expect(stats.tarefasConcluidas).toBe(2);
    expect(stats.totalAgentes).toBe(5);
  });

  it("distribui tarefas por status somando o total", () => {
    const dist = statusDistribution(initialState());
    const soma = dist.reduce((total, item) => total + item.value, 0);
    expect(soma).toBe(computeStats(initialState()).totalTarefas);
  });

  it("ordena a carga por agente de forma decrescente", () => {
    const carga = tasksByAgent(initialState());
    const valores = carga.map((item) => item.value);
    expect(valores).toEqual([...valores].sort((a, b) => b - a));
    expect(carga.length).toBeLessThanOrEqual(5);
  });
});
