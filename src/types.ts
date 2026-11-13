// Modelo de domínio do FIRE Agent Command Center.
// Todos os registros carregam a flag `demo` para deixar explícito que são dados
// demonstrativos — nenhum agente aqui representa uma conexão real.

export type AgentStatus = "ativo" | "pausado" | "treinando" | "offline";

export interface Agent {
  id: string;
  nome: string;
  papel: string;
  status: AgentStatus;
  modelo: string;
  proficiencia: number; // 0-100
  tarefasConcluidas: number;
  descricao: string;
  criadoEm: string; // ISO
  demo: boolean;
}

export type ProjectStatus = "planejado" | "em_andamento" | "pausado" | "concluido";
export type Priority = "baixa" | "media" | "alta";

export interface Project {
  id: string;
  nome: string;
  descricao: string;
  status: ProjectStatus;
  responsavelId: string | null;
  progresso: number; // 0-100
  prioridade: Priority;
  prazo: string; // ISO date
  criadoEm: string;
  demo: boolean;
}

export type TaskStatus = "pendente" | "em_execucao" | "concluida";

export interface Task {
  id: string;
  titulo: string;
  descricao: string;
  status: TaskStatus;
  prioridade: Priority;
  projetoId: string | null;
  agenteId: string | null;
  ordem: number;
  criadoEm: string;
  demo: boolean;
}

export type ActivityType = "agente" | "projeto" | "tarefa" | "sistema";

export interface Activity {
  id: string;
  tipo: ActivityType;
  acao: string;
  alvo: string;
  detalhe?: string;
  timestamp: string;
}

export interface AppState {
  agentes: Agent[];
  projetos: Project[];
  tarefas: Task[];
  atividades: Activity[];
}

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  treinando: "Treinando",
  offline: "Offline",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planejado: "Planejado",
  em_andamento: "Em andamento",
  pausado: "Pausado",
  concluido: "Concluído",
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  concluida: "Concluída",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};
