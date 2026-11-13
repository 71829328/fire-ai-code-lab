// Utilidades de ordenação do quadro Kanban.
//
// Correção da auditoria: a ordem deve ser calculada sobre TODAS as tarefas da
// coluna, nunca sobre a lista filtrada. Caso contrário, ao aplicar um filtro,
// duas tarefas podem receber a mesma `ordem` e a coluna passa a embaralhar.

import { TASK_STATUS_ORDER, type Task, type TaskStatus } from "../types";

export function tarefasDaColuna(tarefas: Task[], status: TaskStatus): Task[] {
  return tarefas
    .filter((tarefa) => tarefa.status === status)
    .sort((a, b) => a.ordem - b.ordem || a.criadoEm.localeCompare(b.criadoEm));
}

// Próxima ordem livre considerando TODAS as tarefas da coluna (não filtradas).
export function proximaOrdem(tarefas: Task[], status: TaskStatus): number {
  const daColuna = tarefas.filter((tarefa) => tarefa.status === status);
  if (daColuna.length === 0) return 0;
  return Math.max(...daColuna.map((tarefa) => tarefa.ordem)) + 1;
}

// Reindexa a ordem (0,1,2...) das tarefas de uma coluna, preservando o
// encadeamento atual. Evita buracos e colisões acumuladas.
export function normalizarColuna(tarefas: Task[], status: TaskStatus): Task[] {
  const ordenadas = tarefasDaColuna(tarefas, status);
  const indicePorId = new Map(ordenadas.map((tarefa, index) => [tarefa.id, index]));
  return tarefas.map((tarefa) => {
    if (tarefa.status !== status) return tarefa;
    const novo = indicePorId.get(tarefa.id);
    return novo === undefined || novo === tarefa.ordem ? tarefa : { ...tarefa, ordem: novo };
  });
}

export function statusAnterior(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_ORDER.indexOf(status);
  return index > 0 ? TASK_STATUS_ORDER[index - 1] : null;
}

export function statusProximo(status: TaskStatus): TaskStatus | null {
  const index = TASK_STATUS_ORDER.indexOf(status);
  return index >= 0 && index < TASK_STATUS_ORDER.length - 1 ? TASK_STATUS_ORDER[index + 1] : null;
}

// Move uma tarefa para o fim da coluna informada, recalculando a ordem sobre o
// conjunto completo e normalizando a coluna de destino.
export function moverParaColuna(tarefas: Task[], id: string, destino: TaskStatus): Task[] {
  const atual = tarefas.find((tarefa) => tarefa.id === id);
  if (!atual || atual.status === destino) return tarefas;
  const ordem = proximaOrdem(tarefas, destino);
  const movidas = tarefas.map((tarefa) =>
    tarefa.id === id ? { ...tarefa, status: destino, ordem } : tarefa
  );
  return normalizarColuna(normalizarColuna(movidas, atual.status), destino);
}
