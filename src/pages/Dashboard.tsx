import { Activity as ActivityIcon, Bot, FolderKanban, ListChecks, TrendingUp } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { computeStats, statusDistribution, tasksByAgent } from "../store/selectors";
import { StatCard } from "../components/ui/StatCard";
import { BarChart, DonutChart, ProgressBar } from "../components/charts/Charts";
import { DemoBadge, ProjectStatusBadge } from "../components/ui/badges";
import type { ActivityType } from "../types";

const activityIcon: Record<ActivityType, typeof ActivityIcon> = {
  agente: Bot,
  projeto: FolderKanban,
  tarefa: ListChecks,
  sistema: ActivityIcon,
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function Dashboard() {
  const { state } = useStore();
  const stats = computeStats(state);
  const concluidasRatio =
    stats.totalTarefas === 0
      ? 0
      : Math.round((stats.tarefasConcluidas / stats.totalTarefas) * 100);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
        <StatCard
          label="Agentes"
          value={stats.totalAgentes}
          hint={`${stats.agentesAtivos} ativos agora`}
          icon={Bot}
          accent="fire"
        />
        <StatCard
          label="Projetos"
          value={stats.totalProjetos}
          hint={`${stats.projetosEmAndamento} em andamento`}
          icon={FolderKanban}
          accent="cyan"
        />
        <StatCard
          label="Tarefas"
          value={stats.totalTarefas}
          hint={`${stats.tarefasConcluidas} concluídas (${concluidasRatio}%)`}
          icon={ListChecks}
          accent="violet"
        />
        <StatCard
          label="Progresso médio"
          value={`${stats.progressoMedio}%`}
          hint="Média de avanço dos projetos"
          icon={TrendingUp}
          accent="emerald"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Distribuição de tarefas
              </h2>
              <p className="text-xs text-slate-400">Por status atual no quadro Kanban</p>
            </div>
            <DemoBadge compact />
          </div>
          <DonutChart data={statusDistribution(state)} />
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">
            Carga por agente
          </h2>
          {tasksByAgent(state).length > 0 ? (
            <BarChart data={tasksByAgent(state)} />
          ) : (
            <p className="text-sm text-slate-400">Nenhuma tarefa atribuída ainda.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">
            Progresso dos projetos
          </h2>
          <ul className="space-y-4">
            {state.projetos.slice(0, 5).map((projeto) => (
              <li key={projeto.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{projeto.nome}</span>
                  <span className="text-xs font-semibold text-slate-300">
                    {projeto.progresso}%
                  </span>
                </div>
                <ProgressBar value={projeto.progresso} />
                <div className="flex items-center gap-2">
                  <ProjectStatusBadge status={projeto.status} />
                  {projeto.demo && <DemoBadge compact />}
                </div>
              </li>
            ))}
            {state.projetos.length === 0 && (
              <li className="text-sm text-slate-400">Nenhum projeto cadastrado.</li>
            )}
          </ul>
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">
            Atividades recentes
          </h2>
          <ul className="space-y-3">
            {state.atividades.slice(0, 6).map((atividade) => {
              const Icon = activityIcon[atividade.tipo];
              return (
                <li key={atividade.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200">
                      <span className="text-slate-400">{atividade.acao} </span>
                      <span className="font-medium">{atividade.alvo}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {dateFormatter.format(new Date(atividade.timestamp))}
                      {atividade.detalhe ? ` · ${atividade.detalhe}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
            {state.atividades.length === 0 && (
              <li className="text-sm text-slate-400">Sem atividades registradas.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
