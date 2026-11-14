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
import { computeStats, missionDistribution, statusDistribution, tasksByAgent } from "../store/selectors";
import { BarChart, DonutChart, ProgressBar } from "../components/charts/Charts";
import { MissionStatusBadge, OrigemBadge, PriorityBadge, ProjectStatusBadge } from "../components/ui/badges";
import type { ActivityType } from "../types";

const activityIcon: Record<ActivityType, typeof ActivityIcon> = {
  agente: Bot, projeto: FolderKanban, tarefa: ListChecks, missao: Target,
  integracao: Plug, execucao: Cpu, sistema: ActivityIcon, backup: Database,
};
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});
const AGENT_IDENTITY: Record<string, { monogram: string; tone: string }> = {
  Aurora: { monogram: "AU", tone: "aurora" },
  Vulcano: { monogram: "VU", tone: "vulcano" },
  Nebula: { monogram: "NE", tone: "nebula" },
  Prisma: { monogram: "PR", tone: "prisma" },
  Orion: { monogram: "OR", tone: "orion" },
};

export function Dashboard() {
  const { state } = useStore();
  const stats = computeStats(state);
  const workload = tasksByAgent(state);
  const completedRatio = stats.totalTarefas === 0
    ? 0
    : Math.round((stats.tarefasConcluidas / stats.totalTarefas) * 100);
  const noRealConnections = stats.agentesConectados === 0 && stats.integracoesAtivas === 0;

  return (
    <div className="fire-page fire-page--dashboard fire-dashboard">
      <section className="fire-dashboard-overview" aria-label="Resumo da operação">
        <div className="fire-dashboard-intro">
          <div className="fire-dashboard-intro-kicker"><span aria-hidden="true">01</span> FIRE INTELLIGENCE <i aria-hidden="true" /></div>
          <h2>Centro de comando</h2>
          <p>Uma leitura objetiva dos registros, missões e estados verificados neste ambiente.</p>
          <div className="fire-dashboard-truth">
            <span className={stats.agentesConectados > 0 ? "fire-dashboard-truth-light is-live" : "fire-dashboard-truth-light"} aria-hidden="true" />
            <span>{stats.agentesConectados} conexões de agente verificadas</span>
          </div>
        </div>
        <div className="fire-dashboard-vitals" aria-label="Indicadores operacionais">
          <article className="fire-vital fire-vital--orange"><span className="fire-vital-label">AGENTES</span><strong>{stats.totalAgentes.toString().padStart(2, "0")}</strong><span className="fire-vital-detail">{stats.agentesConectados} conectados · {stats.agentesCadastrados} cadastrados</span></article>
          <article className="fire-vital fire-vital--cyan"><span className="fire-vital-label">MISSÕES</span><strong>{stats.totalMissoes.toString().padStart(2, "0")}</strong><span className="fire-vital-detail">{stats.missoesAguardandoAprovacao} aguardando aprovação</span></article>
          <article className="fire-vital fire-vital--violet"><span className="fire-vital-label">TAREFAS</span><strong>{stats.totalTarefas.toString().padStart(2, "0")}</strong><span className="fire-vital-detail">{stats.tarefasConcluidas} concluídas · {completedRatio}%</span></article>
          <article className="fire-vital fire-vital--green"><span className="fire-vital-label">EXECUÇÕES LOCAIS</span><strong>{stats.execucoesLocais.toString().padStart(2, "0")}</strong><span className="fire-vital-detail">atividade neste navegador</span></article>
        </div>
      </section>

      {noRealConnections && (
        <aside className="fire-dashboard-integrity" role="status">
          <span className="fire-integrity-sigil" aria-hidden="true">!</span>
          <div><strong>Sem conexões reais ativas</strong><p>Os registros permanecem locais ou demonstrativos; esta visualização não indica atividade externa.</p></div>
          <span className="fire-integrity-total">{stats.integracoesAtivas}/{stats.integracoesTotal} integrações</span>
        </aside>
      )}

      <div className="fire-command-grid">
        <FireCore />
        <aside className="fire-roster" aria-labelledby="fire-roster-title">
          <div className="fire-section-heading">
            <div><p className="fire-kicker">IDENTIDADES REGISTRADAS</p><h2 id="fire-roster-title">Equipe FIRE</h2></div>
            <span className="fire-section-count">{state.agentes.length.toString().padStart(2, "0")}</span>
          </div>
          <ul className="fire-roster-list">
            {state.agentes.slice(0, 6).map((agent, index) => {
              const identity = AGENT_IDENTITY[agent.nome] ?? {
                monogram: String(index + 1).padStart(2, "0"),
                tone: ["aurora", "vulcano", "nebula", "prisma", "orion"][index % 5],
              };
              return (
                <li key={agent.id} className={"fire-roster-item fire-roster-item--" + identity.tone}>
                  <span className="fire-roster-avatar" aria-hidden="true">{identity.monogram}</span>
                  <div className="min-w-0 flex-1"><span className="fire-roster-name">{agent.nome}</span><span className="fire-roster-role">{agent.papel}</span></div>
                  <span className={agent.conexao === "verificado" ? "fire-connection-dot is-connected" : "fire-connection-dot"} title={agent.conexao === "verificado" ? "Conexão verificada" : "Sem conexão verificada"} />
                </li>
              );
            })}
          </ul>
          {state.agentes.length === 0 && <p className="fire-empty-inline">Nenhum agente cadastrado.</p>}
          <p className="fire-roster-footnote"><span className="fire-connection-dot" aria-hidden="true" /> Cadastro local não comprova conexão externa.</p>
          <div className="fire-roster-total"><span>Capacidade cadastrada</span><strong>{state.agentes.length} identidades</strong></div>
        </aside>
      </div>

      <section className="fire-mission-pulse" aria-labelledby="fire-mission-pulse-title">
        <div className="fire-section-heading">
          <div><p className="fire-kicker">FILA PRIORITÁRIA</p><h2 id="fire-mission-pulse-title">Missões recentes</h2></div>
          <div className="fire-mission-summary"><span>{stats.missoesAguardandoAprovacao.toString().padStart(2, "0")}</span> aguardando aprovação</div>
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
        ) : <p className="fire-empty-inline">Nenhuma missão registrada.</p>}
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
          {workload.length ? <BarChart data={workload} /> : <p className="fire-empty-inline">Nenhuma tarefa atribuída ainda.</p>}
        </article>
      </section>

      <section className="fire-dashboard-bottom">
        <article className="fire-dashboard-panel">
          <div className="fire-section-heading"><div><p className="fire-kicker">PORTFÓLIO</p><h2>Progresso dos projetos</h2></div></div>
          <ul className="fire-project-list">
            {state.projetos.slice(0, 5).map((project) => (
              <li key={project.id} className="fire-project-row">
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-200">{project.nome}</span><span className="text-xs tabular-nums text-slate-300">{project.progresso}%</span></div>
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
                  <div className="min-w-0"><p className="text-sm text-slate-200"><span className="text-slate-400">{activity.acao} </span><span className="font-medium">{activity.alvo}</span></p><p className="text-xs text-slate-500">{dateFormatter.format(new Date(activity.timestamp))}{activity.detalhe ? " · " + activity.detalhe : ""}</p></div>
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
