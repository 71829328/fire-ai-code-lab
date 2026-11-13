import { describe, expect, it } from "vitest";
import { initialState, proximoCodigoMissao, reducer } from "./reducer";
import {
  computeStats,
  dependenciasSatisfeitas,
  missoesParaAprovacao,
  missionDistribution,
  statusDistribution,
  tasksByAgent,
} from "./selectors";
import type { Agent, LocalExecution } from "../types";

// Payload v2: o agente cadastrado pelo usuário nasce sempre "desconectado" —
// a auditoria exige que nenhum agente apareça online sem comprovação real.
const novoAgente: Omit<Agent, "id" | "criadoEm"> = {
  nome: "Teste",
  papel: "Analista",
  status: "disponivel",
  modelo: "FIRE-Core 3",
  proficiencia: 80,
  tarefasConcluidas: 0,
  descricao: "Agente de teste",
  origem: "cadastrado",
  conexao: "desconectado",
  provedorId: null,
  verificadoEm: null,
};

describe("reducer — agentes (auditoria: cadastrado vs demonstrativo vs conectado)", () => {
  it("cadastra um agente como 'cadastrado', nunca conectado, com id gerado", () => {
    const state = reducer(initialState(), { type: "agente/criar", payload: novoAgente });
    const criado = state.agentes[0];
    expect(criado.nome).toBe("Teste");
    expect(criado.origem).toBe("cadastrado");
    expect(criado.conexao).toBe("desconectado");
    expect(criado.verificadoEm).toBeNull();
    expect(criado.id).toMatch(/^ag-/);
    expect(state.atividades[0].tipo).toBe("agente");
  });

  it("preserva origem e conexão ao atualizar um agente demonstrativo", () => {
    const inicial = initialState();
    const alvo = inicial.agentes[0];
    expect(alvo.origem).toBe("demonstrativo");
    const state = reducer(inicial, {
      type: "agente/atualizar",
      payload: { ...alvo, nome: "Renomeado" },
    });
    const atualizado = state.agentes.find((a) => a.id === alvo.id)!;
    expect(atualizado.nome).toBe("Renomeado");
    expect(atualizado.origem).toBe("demonstrativo");
  });

  it("impede que a edição promova a conexão para 'verificado' sem comprovação", () => {
    const inicial = initialState();
    const alvo = inicial.agentes[0];
    const state = reducer(inicial, {
      type: "agente/atualizar",
      // Tentativa maliciosa/errada: forçar conexão verificada pelo formulário.
      payload: { ...alvo, conexao: "verificado", verificadoEm: new Date().toISOString() },
    });
    const atualizado = state.agentes.find((a) => a.id === alvo.id)!;
    expect(atualizado.conexao).toBe("desconectado");
    expect(atualizado.verificadoEm).toBeNull();
  });

  it("desvincula referências (tarefas, projetos e missões) ao remover um agente", () => {
    const inicial = initialState();
    const alvo = inicial.agentes.find((a) => a.id === "ag-001")!;
    const state = reducer(inicial, { type: "agente/remover", payload: { id: alvo.id } });
    expect(state.agentes.some((a) => a.id === alvo.id)).toBe(false);
    expect(state.tarefas.every((t) => t.agenteId !== alvo.id)).toBe(true);
    expect(state.projetos.every((p) => p.responsavelId !== alvo.id)).toBe(true);
    expect(state.missoes.every((m) => m.agenteId !== alvo.id)).toBe(true);
  });
});

describe("reducer — tarefas", () => {
  it("cria tarefa com origem 'cadastrado' e id gerado", () => {
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
        origem: "cadastrado",
      },
    });
    expect(state.tarefas[0].titulo).toBe("Nova tarefa");
    expect(state.tarefas[0].origem).toBe("cadastrado");
  });

  it("move a tarefa para o novo status e registra atividade", () => {
    const inicial = initialState();
    const alvo = inicial.tarefas.find((t) => t.status === "pendente")!;
    const state = reducer(inicial, {
      type: "tarefa/mover",
      payload: { id: alvo.id, status: "concluida" },
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
      payload: { id: alvo.id, status: alvo.status },
    });
    expect(state).toBe(inicial);
  });
});

describe("reducer — missões (central de missões)", () => {
  it("cria missão com código único sequencial, histórico inicial e sem evidências", () => {
    const inicial = initialState();
    const state = reducer(inicial, {
      type: "missao/criar",
      payload: {
        titulo: "Nova missão",
        objetivo: "Objetivo",
        instrucoes: "Instruções",
        prioridade: "alta",
        criteriosAceite: ["Critério 1"],
        agenteId: null,
        projetoId: null,
        dependencias: [],
        status: "pendente",
        origem: "cadastrado",
      },
    });
    const criada = state.missoes[0];
    expect(criada.codigo).toBe("MSN-0006");
    expect(criada.evidencias).toHaveLength(0);
    expect(criada.historico).toHaveLength(1);
    expect(criada.historico[0].descricao).toBe("Missão cadastrada");
    expect(state.atividades[0].tipo).toBe("missao");
  });

  it("gera o próximo código mesmo com códigos não sequenciais", () => {
    expect(proximoCodigoMissao([])).toBe("MSN-0001");
    expect(
      proximoCodigoMissao([
        { codigo: "MSN-0009" } as never,
        { codigo: "MSN-0003" } as never,
      ])
    ).toBe("MSN-0010");
  });

  it("registra entrada de histórico e atualizadoEm ao alterar o status", () => {
    const inicial = initialState();
    const alvo = inicial.missoes.find((m) => m.id === "ms-004")!;
    const antes = alvo.historico.length;
    const state = reducer(inicial, {
      type: "missao/status",
      payload: { id: alvo.id, status: "execucao_manual", descricao: "Iniciada manualmente" },
    });
    const atualizada = state.missoes.find((m) => m.id === alvo.id)!;
    expect(atualizada.status).toBe("execucao_manual");
    expect(atualizada.historico.length).toBe(antes + 1);
    expect(atualizada.historico.at(-1)!.descricao).toBe("Iniciada manualmente");
  });

  it("não altera o estado ao repetir o status atual", () => {
    const inicial = initialState();
    const alvo = inicial.missoes[0];
    const state = reducer(inicial, {
      type: "missao/status",
      payload: { id: alvo.id, status: alvo.status },
    });
    expect(state).toBe(inicial);
  });

  it("adiciona e remove evidências de uma missão", () => {
    const inicial = initialState();
    const alvo = inicial.missoes.find((m) => m.id === "ms-003")!;
    const comEvidencia = reducer(inicial, {
      type: "missao/evidencia/adicionar",
      payload: {
        id: alvo.id,
        evidencia: { tipo: "relatorio", descricao: "Relatório", valor: "anexo.pdf", autor: "importado" },
      },
    });
    const missao = comEvidencia.missoes.find((m) => m.id === alvo.id)!;
    expect(missao.evidencias).toHaveLength(1);
    const evidenciaId = missao.evidencias[0].id;

    const semEvidencia = reducer(comEvidencia, {
      type: "missao/evidencia/remover",
      payload: { id: alvo.id, evidenciaId },
    });
    expect(semEvidencia.missoes.find((m) => m.id === alvo.id)!.evidencias).toHaveLength(0);
  });

  it("remove a referência à missão excluída nas dependências de outras missões", () => {
    const inicial = initialState();
    // ms-002 depende de ms-001.
    const state = reducer(inicial, { type: "missao/remover", payload: { id: "ms-001" } });
    const ms002 = state.missoes.find((m) => m.id === "ms-002")!;
    expect(ms002.dependencias).not.toContain("ms-001");
    expect(state.missoes.some((m) => m.id === "ms-001")).toBe(false);
  });
});

describe("reducer — integrações (nunca ativadas sem acesso real)", () => {
  it("ao solicitar autorização, permanece desativada/aguardando sem virar 'ativa'", () => {
    const inicial = initialState();
    const state = reducer(inicial, { type: "integracao/solicitar", payload: { id: "codex" } });
    const integracao = state.integracoes.find((i) => i.id === "codex")!;
    expect(integracao.estado).toBe("aguardando_autorizacao");
    expect(integracao.ultimaVerificacao).toBeNull();
    expect(state.integracoes.every((i) => i.estado !== "ativa")).toBe(true);
  });
});

describe("reducer — execução local e backup", () => {
  const execucao: LocalExecution = {
    id: "ex-teste",
    missaoId: null,
    entrada: "abc",
    saida: { caracteres: 3, palavras: 1, linhas: 1, resumo: "ok" },
    checksum: "fnv1a-00000000",
    verificacao: { passou: true, detalhe: "ok" },
    duracaoMs: 1,
    timestamp: new Date().toISOString(),
    modo: "local",
  };

  it("registra execução local distinguindo-a de execução por IA", () => {
    const state = reducer(initialState(), { type: "execucao/registrar", payload: execucao });
    expect(state.execucoes[0].modo).toBe("local");
    expect(state.atividades[0].tipo).toBe("execucao");
  });

  it("prefixa o estado importado com atividade de backup", () => {
    const importado = initialState();
    const state = reducer(importado, { type: "estado/importar", payload: importado });
    expect(state.atividades[0].tipo).toBe("backup");
    expect(state.atividades[0].acao).toContain("importou backup");
  });

  it("restaura o conjunto demonstrativo no reset", () => {
    const alterado = reducer(initialState(), { type: "agente/criar", payload: novoAgente });
    const restaurado = reducer(alterado, { type: "estado/resetar" });
    expect(restaurado.agentes).toHaveLength(5);
    expect(restaurado.agentes.every((a) => a.origem === "demonstrativo")).toBe(true);
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

  it("nunca conta agentes conectados sem comprovação real", () => {
    const stats = computeStats(initialState());
    expect(stats.agentesConectados).toBe(0);
    expect(stats.agentesDemonstrativos).toBe(5);
    expect(stats.agentesCadastrados).toBe(0);
  });

  it("mantém a soma das distribuições igual ao total", () => {
    const dist = statusDistribution(initialState());
    expect(dist.reduce((t, i) => t + i.value, 0)).toBe(computeStats(initialState()).totalTarefas);

    const distMissoes = missionDistribution(initialState());
    expect(distMissoes.reduce((t, i) => t + i.value, 0)).toBe(
      computeStats(initialState()).totalMissoes
    );
  });

  it("ordena a carga por agente de forma decrescente", () => {
    const carga = tasksByAgent(initialState());
    const valores = carga.map((item) => item.value);
    expect(valores).toEqual([...valores].sort((a, b) => b - a));
    expect(carga.length).toBeLessThanOrEqual(5);
  });

  it("lista apenas missões aguardando aprovação", () => {
    const pendentes = missoesParaAprovacao(initialState());
    expect(pendentes.every((m) => m.status === "aguardando_aprovacao")).toBe(true);
    expect(pendentes.map((m) => m.codigo)).toContain("MSN-0002");
  });

  it("avalia corretamente se as dependências foram concluídas", () => {
    const inicial = initialState();
    // ms-002 depende de ms-001 (concluída) — satisfeita.
    expect(dependenciasSatisfeitas(inicial, "ms-002")).toBe(true);
    // ms-004 depende de ms-003 (execução manual) — não satisfeita.
    expect(dependenciasSatisfeitas(inicial, "ms-004")).toBe(false);
  });
});
