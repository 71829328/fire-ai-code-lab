import type { AppState } from "../types";

export interface DashboardStats {
  totalAgentes: number;
  agentesAtivos: number;
  totalProjetos: number;
  projetosEmAndamento: number;
  totalTarefas: number;
  tarefasPendentes: number;
  tarefasEmExecucao: number;
  tarefasConcluidas: number;
  progressoMedio: number;
}

export function computeStats(state: AppState): DashboardStats {
  const { agentes, projetos, tarefas } = state;
  const progressoMedio =
    projetos.length === 0
      ? 0
      : Math.round(
          projetos.reduce((total, p) => total + p.progresso, 0) / projetos.length
        );
  return {
    totalAgentes: agentes.length,
    agentesAtivos: agentes.filter((a) => a.status === "ativo").length,
    totalProjetos: projetos.length,
    projetosEmAndamento: projetos.filter((p) => p.status === "em_andamento").length,
    totalTarefas: tarefas.length,
    tarefasPendentes: tarefas.filter((t) => t.status === "pendente").length,
    tarefasEmExecucao: tarefas.filter((t) => t.status === "em_execucao").length,
    tarefasConcluidas: tarefas.filter((t) => t.status === "concluida").length,
    progressoMedio,
  };
}

export function statusDistribution(state: AppState) {
  const stats = computeStats(state);
  return [
    { label: "Pendentes", value: stats.tarefasPendentes, color: "#ff7a1a" },
    { label: "Em execução", value: stats.tarefasEmExecucao, color: "#22d3ee" },
    { label: "Concluídas", value: stats.tarefasConcluidas, color: "#a855f7" },
  ];
}

// Distribuição de tarefas por agente (top 5), usada no gráfico de barras.
export function tasksByAgent(state: AppState) {
  return state.agentes
    .map((agente) => ({
      label: agente.nome,
      value: state.tarefas.filter((t) => t.agenteId === agente.id).length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}
