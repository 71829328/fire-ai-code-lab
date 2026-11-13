// Modelo de domínio do FIRE Agent Command Center (v2 — central de missões).
//
// Regra central de honestidade operacional: nenhum agente é apresentado como
// "conectado" sem verificação real. Para isso todo agente carrega:
//   - `origem`: se foi criado pelo usuário ("cadastrado") ou veio do conjunto
//     de exemplo ("demonstrativo");
//   - `conexao`: "verificado" apenas quando houver integração real autorizada e
//     validada. Sem isso permanece "desconectado".

export const APP_STATE_VERSION = 2;

export type Origem = "demonstrativo" | "cadastrado";

/* ------------------------------------------------------------------ */
/* Integrações (camada operacional)                                    */
/* ------------------------------------------------------------------ */

export type IntegrationProviderId = "chatgpt" | "codex" | "work" | "trae" | "manus";

// Estado de integração. Toda integração inicia "desativada" e só pode ir para
// "ativa" após verificação real de credencial/permissão — o que não ocorre
// nesta demonstração.
export type IntegrationState = "desativada" | "aguardando_autorizacao" | "ativa";

export interface Integration {
  id: IntegrationProviderId;
  nome: string;
  descricao: string;
  estado: IntegrationState;
  requer: string;
  capacidades: string[];
  ultimaVerificacao: string | null;
  origem: Origem;
}

/* ------------------------------------------------------------------ */
/* Agentes                                                             */
/* ------------------------------------------------------------------ */

export type AgentStatus = "disponivel" | "pausado" | "treinando" | "inativo";
export type AgentConexao = "desconectado" | "verificado";

export interface Agent {
  id: string;
  nome: string;
  papel: string;
  status: AgentStatus;
  modelo: string;
  proficiencia: number; // 0-100
  tarefasConcluidas: number;
  descricao: string;
  origem: Origem;
  conexao: AgentConexao;
  provedorId: IntegrationProviderId | null;
  verificadoEm: string | null;
  criadoEm: string; // ISO
}

/* ------------------------------------------------------------------ */
/* Projetos e Tarefas                                                  */
/* ------------------------------------------------------------------ */

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
  origem: Origem;
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
  origem: Origem;
}

/* ------------------------------------------------------------------ */
/* Missões                                                             */
/* ------------------------------------------------------------------ */

export type MissionStatus =
  | "pendente"
  | "execucao_manual"
  | "aguardando_aprovacao"
  | "concluida"
  | "bloqueada";

export type EvidenceType = "evidencia" | "commit" | "resultado" | "relatorio";
export type EvidenceAuthor = "usuario" | "executor_local" | "importado";

export interface MissionEvidence {
  id: string;
  tipo: EvidenceType;
  descricao: string;
  valor: string;
  autor: EvidenceAuthor;
  timestamp: string;
}

export interface MissionHistoryEntry {
  id: string;
  status: MissionStatus;
  descricao: string;
  timestamp: string;
}

export interface Mission {
  id: string;
  codigo: string; // identificador único legível, ex.: MSN-0001
  titulo: string;
  objetivo: string;
  instrucoes: string;
  prioridade: Priority;
  criteriosAceite: string[];
  agenteId: string | null;
  projetoId: string | null;
  dependencias: string[]; // ids de outras missões
  status: MissionStatus;
  origem: Origem;
  evidencias: MissionEvidence[];
  historico: MissionHistoryEntry[];
  criadoEm: string;
  atualizadoEm: string;
}

/* ------------------------------------------------------------------ */
/* Execução local de demonstração                                      */
/* ------------------------------------------------------------------ */

export interface LocalExecution {
  id: string;
  missaoId: string | null;
  entrada: string;
  saida: {
    caracteres: number;
    palavras: number;
    linhas: number;
    resumo: string;
  };
  checksum: string;
  verificacao: { passou: boolean; detalhe: string };
  duracaoMs: number;
  timestamp: string;
  modo: "local";
}

/* ------------------------------------------------------------------ */
/* Atividades                                                          */
/* ------------------------------------------------------------------ */

export type ActivityType =
  | "agente"
  | "projeto"
  | "tarefa"
  | "missao"
  | "integracao"
  | "execucao"
  | "sistema"
  | "backup";

export interface Activity {
  id: string;
  tipo: ActivityType;
  acao: string;
  alvo: string;
  detalhe?: string;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Estado global                                                       */
/* ------------------------------------------------------------------ */

export interface AppState {
  versao: number;
  agentes: Agent[];
  projetos: Project[];
  tarefas: Task[];
  missoes: Mission[];
  integracoes: Integration[];
  execucoes: LocalExecution[];
  atividades: Activity[];
}

/* ------------------------------------------------------------------ */
/* Rótulos                                                             */
/* ------------------------------------------------------------------ */

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  disponivel: "Disponível",
  pausado: "Pausado",
  treinando: "Em treinamento",
  inativo: "Inativo",
};

export const AGENT_CONEXAO_LABEL: Record<AgentConexao, string> = {
  desconectado: "Sem conexão comprovada",
  verificado: "Conexão verificada",
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

export const TASK_STATUS_ORDER: TaskStatus[] = ["pendente", "em_execucao", "concluida"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  pendente: "Pendente",
  execucao_manual: "Execução manual",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  bloqueada: "Bloqueada",
};

export const EVIDENCE_TYPE_LABEL: Record<EvidenceType, string> = {
  evidencia: "Evidência",
  commit: "Commit",
  resultado: "Resultado",
  relatorio: "Relatório",
};

export const INTEGRATION_STATE_LABEL: Record<IntegrationState, string> = {
  desativada: "Desativada",
  aguardando_autorizacao: "Aguardando autorização",
  ativa: "Ativa",
};
