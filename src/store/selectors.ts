import type { AppState } from "../types";

export interface DashboardStats {
  totalAgentes: number;
  agentesDemonstrativos: number;
  agentesCadastrados: number;
  // Agentes com conexão comprovada/verificada — nunca inferida.
  agentesConectados: number;
  totalProjetos: number;
  projetosEmAndamento: number;
  totalTarefas: number;
  tarefasPendentes: number;
  tarefasEmExecucao: number;
  tarefasConcluidas: number;
  totalMissoes: number;
  missoesPendentes: number;
  missoesEmExecucaoManual: number;
  missoesAguardandoAprovacao: number;
  missoesConcluidas: number;
  missoesBloqueadas: number;
  integracoesAtivas: number;
  integracoesTotal: number;
  execucoesLocais: number;
  progressoMedio: number;
}

export function computeStats(state: AppState): DashboardStats {
  const { agentes, projetos, tarefas, missoes, integracoes, execucoes } = state;
  const progressoMedio =
    projetos.length === 0
      ? 0
      : Math.round(
          projetos.reduce((total, p) => total + p.progresso, 0) / projetos.length
        );
  return {
    totalAgentes: agentes.length,
    agentesDemonstrativos: agentes.filter((a) => a.origem === "demonstrativo").length,
    agentesCadastrados: agentes.filter((a) => a.origem === "cadastrado").length,
    agentesConectados: agentes.filter((a) => a.conexao === "verificado").length,
    totalProjetos: projetos.length,
    projetosEmAndamento: projetos.filter((p) => p.status === "em_andamento").length,
    totalTarefas: tarefas.length,
    tarefasPendentes: tarefas.filter((t) => t.status === "pendente").length,
    tarefasEmExecucao: tarefas.filter((t) => t.status === "em_execucao").length,
    tarefasConcluidas: tarefas.filter((t) => t.status === "concluida").length,
    totalMissoes: missoes.length,
    missoesPendentes: missoes.filter((m) => m.status === "pendente").length,
    missoesEmExecucaoManual: missoes.filter((m) => m.status === "execucao_manual").length,
    missoesAguardandoAprovacao: missoes.filter((m) => m.status === "aguardando_aprovacao").length,
    missoesConcluidas: missoes.filter((m) => m.status === "concluida").length,
    missoesBloqueadas: missoes.filter((m) => m.status === "bloqueada").length,
    integracoesAtivas: integracoes.filter((i) => i.estado === "ativa").length,
    integracoesTotal: integracoes.length,
    execucoesLocais: execucoes.length,
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

export function missionDistribution(state: AppState) {
  const stats = computeStats(state);
  return [
    { label: "Pendentes", value: stats.missoesPendentes, color: "#ff7a1a" },
    { label: "Execução manual", value: stats.missoesEmExecucaoManual, color: "#22d3ee" },
    { label: "Aguardando aprovação", value: stats.missoesAguardandoAprovacao, color: "#facc15" },
    { label: "Concluídas", value: stats.missoesConcluidas, color: "#a855f7" },
    { label: "Bloqueadas", value: stats.missoesBloqueadas, color: "#f43f5e" },
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

// Missões prontas para revisão técnica.
export function missoesParaAprovacao(state: AppState) {
  return state.missoes.filter((m) => m.status === "aguardando_aprovacao");
}

// Verifica se todas as dependências de uma missão estão concluídas.
export function dependenciasSatisfeitas(state: AppState, missaoId: string): boolean {
  const missao = state.missoes.find((m) => m.id === missaoId);
  if (!missao) return true;
  return missao.dependencias.every(
    (depId) => state.missoes.find((m) => m.id === depId)?.status === "concluida"
  );
}
