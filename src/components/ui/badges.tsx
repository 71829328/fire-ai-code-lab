import {
  AGENT_STATUS_LABEL,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  type AgentStatus,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
} from "../../types";

const agentStyles: Record<AgentStatus, string> = {
  ativo: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  pausado: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  treinando: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  offline: "border-slate-500/30 bg-slate-500/10 text-slate-300",
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

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return <span className={`chip ${agentStyles[status]}`}>{AGENT_STATUS_LABEL[status]}</span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`chip ${projectStyles[status]}`}>{PROJECT_STATUS_LABEL[status]}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`chip ${taskStyles[status]}`}>{TASK_STATUS_LABEL[status]}</span>;
}

export function PriorityBadge({ prioridade }: { prioridade: Priority }) {
  return (
    <span className={`chip ${priorityStyles[prioridade]}`}>
      Prioridade {PRIORITY_LABEL[prioridade]}
    </span>
  );
}

// Marca visual obrigatória para registros que não foram criados pelo usuário.
export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className="demo-badge" title="Registro demonstrativo — não representa um agente real conectado.">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
      {compact ? "Demo" : "Demonstração"}
    </span>
  );
}
