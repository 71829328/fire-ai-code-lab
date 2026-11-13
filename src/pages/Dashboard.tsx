import {
  Activity as ActivityIcon,
  Bot,
  Cpu,
  Database,
  FolderKanban,
  ListChecks,
  Plug,
  Target,
} from "lucide-react";
import { FireCore } from "../components/ui/FireCore";
import { useStore } from "../store/StoreContext";
import {
  computeStats,
  missionDistribution,
  statusDistribution,
  tasksByAgent,
} from "../store/selectors";
import { StatCard } from "../components/ui/StatCard";
import { BarChart, DonutChart, ProgressBar } from "../components/charts/Charts";
import { OrigemBadge, ProjectStatusBadge } from "../components/ui/badges";
import type { ActivityType } from "../types";

// Mapa de ícones cobrindo todos os ActivityType do domínio v2.
const activityIcon: Record<ActivityType, typeof ActivityIcon> = {
  agente: Bot,
  projeto: FolderKanban,
  tarefa: ListChecks,
  missao: Target,
  integracao: Plug,
  execucao: Cpu,
  sistema: ActivityIcon,
  backup: Database,
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
  const cargaPorAgente = tasksByAgent(state);
  const concluidasRatio =
    stats.totalTarefas === 0
      ? 0
      : Math.round((stats.tarefasConcluidas / stats.totalTarefas) * 100);
  const semConexaoReal = stats.agentesConectados === 0 && stats.integracoesAtivas === 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
        <StatCard
          label="Agentes"
          value={stats.totalAgentes}
          hint={`${stats.agentesConectados} conectados · ${stats.agentesCadastrados} cadastrados`}
          icon={Bot}
          accent="fire"
        />
        <StatCard
          label="Missões"
          value={stats.totalMissoes}
          hint={`${stats.missoesAguardandoAprovacao} aguardando aprovação`}
          icon={Target}
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
          label="Execuções locais"
          value={stats.execucoesLocais}
          hint="Demonstração no navegador"
          icon={Cpu}
          accent="emerald"
        />
      </section>

      <FireCore />
      <section className="glass-soft flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Indicadores operacionais
        </h2>
        <span className="chip border-white/10 bg-white/5 text-slate-200">
          {stats.agentesConectados} agentes conectados
        </span>
        <span className="chip border-white/10 bg-white/5 text-slate-200">
          {stats.integracoesAtivas}/{stats.integracoesTotal} integrações ativas
        </span>
        {semConexaoReal && (
          <p className="text-xs text-amber-200">
            Nenhuma conexão real ativa: todos os dados são demonstrativos e nenhuma integração
            externa está habilitada.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Missões por status</h2>
          <DonutChart data={missionDistribution(state)} />
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Tarefas por status</h2>
          <DonutChart data={statusDistribution(state)} />
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Carga por agente</h2>
          {cargaPorAgente.length > 0 ? (
            <BarChart data={cargaPorAgente} />
          ) : (
            <p className="text-sm text-slate-400">Nenhuma tarefa atribuída ainda.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Progresso dos projetos</h2>
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
                <div className="flex flex-wrap items-center gap-2">
                  <ProjectStatusBadge status={projeto.status} />
                  <OrigemBadge origem={projeto.origem} />
                </div>
              </li>
            ))}
            {state.projetos.length === 0 && (
              <li className="text-sm text-slate-400">Nenhum projeto cadastrado.</li>
            )}
          </ul>
        </div>

        <div className="glass p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-100">Atividades recentes</h2>
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
