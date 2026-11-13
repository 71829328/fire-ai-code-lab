import {
  AGENT_CONEXAO_LABEL,
  AGENT_STATUS_LABEL,
  EVIDENCE_TYPE_LABEL,
  INTEGRATION_STATE_LABEL,
  MISSION_STATUS_LABEL,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type AgentConexao,
  type AgentStatus,
  type EvidenceType,
  type IntegrationState,
  type MissionStatus,
  type Origem,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
} from "../../types";

const agentStyles: Record<AgentStatus, string> = {
  disponivel: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  pausado: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  treinando: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  inativo: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const connectionStyles: Record<AgentConexao, string> = {
  desconectado: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  verificado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};

const projectStyles: Record<ProjectStatus, string> = {
  planejado: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  em_andamento: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  pausado: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  concluido: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

const taskStyles: Record<TaskStatus, string> = {
  pendente: "border-fire/40 bg-fire/10 text-fire-soft",
  em_execucao: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  concluida: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

const priorityStyles: Record<Priority, string> = {
  alta: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  media: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  baixa: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

const missionStyles: Record<MissionStatus, string> = {
  pendente: "border-fire/40 bg-fire/10 text-fire-soft",
  execucao_manual: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  aguardando_aprovacao: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  concluida: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  bloqueada: "border-rose-400/40 bg-rose-500/10 text-rose-200",
};

const integrationStyles: Record<IntegrationState, string> = {
  desativada: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  aguardando_autorizacao: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  ativa: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <span className={`chip ${agentStyles[status]}`}>{AGENT_STATUS_LABEL[status]}</span>;
}

// Conexão comprovada (ou não). Sem verificação real, exibe "Sem conexão comprovada".
export function ConnectionBadge({ conexao }: { conexao: AgentConexao }) {
  const verificado = conexao === "verificado";
  return (
    <span
      className={`chip ${connectionStyles[conexao]}`}
      title={
        verificado
          ? "Conexão verificada a partir de uma autorização real registrada."
          : "Nenhuma integração real foi autorizada/verificada para este agente."
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${verificado ? "bg-emerald-300" : "bg-slate-400"}`}
        aria-hidden
      />
      {AGENT_CONEXAO_LABEL[conexao]}
    </span>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`chip ${projectStyles[status]}`}>{PROJECT_STATUS_LABEL[status]}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`chip ${taskStyles[status]}`}>{TASK_STATUS_LABEL[status]}</span>;
}

export function MissionStatusBadge({ status }: { status: MissionStatus }) {
  return <span className={`chip ${missionStyles[status]}`}>{MISSION_STATUS_LABEL[status]}</span>;
}

export function IntegrationStateBadge({ estado }: { estado: IntegrationState }) {
  return <span className={`chip ${integrationStyles[estado]}`}>{INTEGRATION_STATE_LABEL[estado]}</span>;
}

export function EvidenceTypeBadge({ tipo }: { tipo: EvidenceType }) {
  return (
    <span className="chip border-white/10 bg-white/5 text-slate-300">
      {EVIDENCE_TYPE_LABEL[tipo]}
    </span>
  );
}

export function PriorityBadge({ prioridade }: { prioridade: Priority }) {
  return (
    <span className={`chip ${priorityStyles[prioridade]}`}>
      Prioridade {PRIORITY_LABEL[prioridade]}
    </span>
  );
}

// Distingue registros de exemplo dos criados pelo usuário.
export function OrigemBadge({ origem }: { origem: Origem }) {
  if (origem === "cadastrado") {
    return (
      <span
        className="chip border-cyan-400/30 bg-cyan-400/10 text-cyan-200"
        title="Registro criado por você nesta sessão/instalação."
      >
        Cadastrado
      </span>
    );
  }
  return (
    <span
      className="demo-badge"
      title="Registro demonstrativo — não representa um agente real conectado."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
      Demonstração
    </span>
  );
}

// Mantido por compatibilidade com telas que usam apenas o selo de demonstração.
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="demo-badge"
      title="Registro demonstrativo — não representa um agente real conectado."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
      {compact ? "Demo" : "Demonstração"}
    </span>
  );
}
