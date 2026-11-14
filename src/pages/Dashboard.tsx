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
import {
  MissionStatusBadge,
  OrigemBadge,
  PriorityBadge,
  ProjectStatusBadge,
} from "../components/ui/badges";
import type { ActivityType } from "../types";

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
    <div className="fire-page fire-page--dashboard space-y-6">
      <section className="fire-dashboard-metrics grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger" aria-label="Resumo operacional">
        <StatCard label="Agentes" value={stats.totalAgentes} hint={`${stats.agentesConectados} conectados · ${stats.agentesCadastrados} cadastrados`} icon={Bot} accent="fire" />
        <StatCard label="Missões" value={stats.totalMissoes} hint={`${stats.missoesAguardandoAprovacao} aguardando aprovação`} icon={Target} accent="cyan" />
        <StatCard label="Tarefas" value={stats.totalTarefas} hint={`${stats.tarefasConcluidas} concluídas · ${concluidasRatio}%`} icon={ListChecks} accent="violet" />
        <StatCard label="Execuções locais" value={stats.execucoesLocais} hint="Atividade registrada neste navegador" icon={Cpu} accent="emerald" />
      </section>

      {semConexaoReal && (
        <aside className="fire-operational-alert" role="status">
          <span className="fire-status-dot" aria-hidden />
          <p><strong>Sem conexões reais ativas.</strong> Os dados abaixo refletem registros locais e demonstrativos.</p>
          <span className="fire-alert-count">{stats.integracoesAtivas}/{stats.integracoesTotal} integrações ativas</span>
        </aside>
      )}

      <div className="fire-command-grid">
        <FireCore />
        <section className="fire-roster" aria-labelledby="fire-roster-title">
          <div className="fire-section-heading">
            <div>
              <p className="fire-kicker">EQUIPE REGISTRADA</p>
              <h2 id="fire-roster-title">Agentes</h2>
            </div>
            <span className="fire-section-count">{state.agentes.length.toString().padStart(2, "0")}</span>
          </div>
          <ul className="fire-roster-list">
            {state.agentes.slice(0, 6).map((agent) => (
              <li key={agent.id} className="fire-roster-item">
                <Bot className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-100">{agent.nome}</span>
                  <span className="text-xs text-slate-400">{agent.origem === "demonstrativo" ? "Demonstração" : "Cadastro local"}</span>
                </div>
                <span className={agent.conexao === "verificado" ? "fire-connection-dot is-connected" : "fire-connection-dot"} title={agent.conexao === "verificado" ? "Conexão verificada" : "Sem conexão verificada"} />
              </li>
            ))}
          </ul>
          {state.agentes.length === 0 && <p className="fire-empty-inline">Nenhum agente cadastrado.</p>}
          <p className="fire-roster-footnote">Cadastro local não comprova conexão externa.</p>
        </section>
      </div>

      <section className="fire-mission-pulse" aria-labelledby="fire-mission-pulse-title">
        <div className="fire-section-heading">
          <div>
            <p className="fire-kicker">ACOMPANHAMENTO</p>
            <h2 id="fire-mission-pulse-title">Missões recentes</h2>
          </div>
          <span className="fire-section-count">{state.missoes.length.toString().padStart(2, "0")}</span>
        </div>
        {state.missoes.length ? (
          <ul className="fire-mission-list">
            {state.missoes.slice(0, 4).map((mission) => (
              <li key={mission.id} className="fire-mission-row">
                <span className="fire-mission-code">{mission.codigo}</span>
                <span className="fire-mission-title">{mission.titulo}</span>
                <PriorityBadge prioridade={mission.prioridade} />
                <MissionStatusBadge status={mission.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="fire-empty-inline">Nenhuma missão registrada.</p>
        )}
      </section>

      <section className="fire-dashboard-analytics" aria-label="Indicadores e distribuição">
        <article className="fire-dashboard-panel">
          <div className="fire-section-heading"><div><p className="fire-kicker">DISTRIBUIÇÃO</p><h2>Missões por status</h2></div></div>
          <DonutChart data={missionDistribution(state)} />
        </article>
        <article className="fire-dashboard-panel">
          <div className="fire-section-heading"><div><p className="fire-kicker">DISTRIBUIÇÃO</p><h2>Tarefas por status</h2></div></div>
          <DonutChart data={statusDistribution(state)} />
        </article>
        <article className="fire-dashboard-panel fire-dashboard-panel--workload">
          <div className="fire-section-heading"><div><p className="fire-kicker">CAPACIDADE</p><h2>Carga por agente</h2></div></div>
          {cargaPorAgente.length ? <BarChart data={cargaPorAgente} /> : <p className="fire-empty-inline">Nenhuma tarefa atribuída ainda.</p>}
        </article>
      </section>

      <section className="fire-dashboard-bottom">
        <article className="fire-dashboard-panel">
          <div className="fire-section-heading"><div><p className="fire-kicker">PORTFÓLIO</p><h2>Progresso dos projetos</h2></div></div>
          <ul className="fire-project-list">
            {state.projetos.slice(0, 5).map((project) => (
              <li key={project.id} className="fire-project-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-200">{project.nome}</span>
                  <span className="text-xs tabular-nums text-slate-300">{project.progresso}%</span>
                </div>
                <ProgressBar value={project.progresso} />
                <div className="flex flex-wrap items-center gap-2"><ProjectStatusBadge status={project.status} /><OrigemBadge origem={project.origem} /></div>
              </li>
            ))}
            {!state.projetos.length && <li className="fire-empty-inline">Nenhum projeto cadastrado.</li>}
          </ul>
        </article>
        <article className="fire-dashboard-panel">
          <div className="fire-section-heading"><div><p className="fire-kicker">TRILHA OPERACIONAL</p><h2>Atividade recente</h2></div></div>
          <ul className="fire-activity-list">
            {state.atividades.slice(0, 6).map((activity) => {
              const Icon = activityIcon[activity.tipo];
              return (
                <li key={activity.id} className="fire-activity-row">
                  <span className="fire-activity-icon"><Icon className="h-4 w-4" aria-hidden /></span>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200"><span className="text-slate-400">{activity.acao} </span><span className="font-medium">{activity.alvo}</span></p>
                    <p className="text-xs text-slate-500">{dateFormatter.format(new Date(activity.timestamp))}{activity.detalhe ? ` · ${activity.detalhe}` : ""}</p>
                  </div>
                </li>
              );
            })}
            {!state.atividades.length && <li className="fire-empty-inline">Sem atividades registradas.</li>}
          </ul>
        </article>
      </section>
    </div>
  );
}
