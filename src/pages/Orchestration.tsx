import { useMemo, useState } from "react";
import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  Cpu,
  Gauge,
  ListChecks,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { useOps } from "../platform/OpsContext";
import { missionParaView } from "../orchestration/engine";
import { filaOrdenada, resumoFila, emExecucao } from "../orchestration/engine";
import { executarLocalmente } from "../orchestration/localRunner";
import { DEFAULT_ENGINE_CONFIG, RUN_STATUS_LABEL, type EngineConfig } from "../orchestration/types";
import { prepararRunDeMissao } from "../platform/ops";
import { RunStatusBadge } from "../components/ui/opsBadges";
import { EmptyState } from "../components/ui/EmptyState";
import { PriorityBadge } from "../components/ui/badges";
import type { Mission } from "../types";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function Orchestration() {
  const { state: store } = useStore();
  const { state, dispatch, podeFazer } = useOps();
  const [missaoId, setMissaoId] = useState("");
  const [criticidade, setCriticidade] = useState<"normal" | "critica">("normal");
  const [config, setConfig] = useState<EngineConfig>(DEFAULT_ENGINE_CONFIG);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const runs = state.runs;
  const fila = useMemo(() => filaOrdenada(runs), [runs]);
  const executando = useMemo(() => emExecucao(runs), [runs]);
  const resumo = useMemo(() => resumoFila(runs), [runs]);
  const pendentesAprovacao = runs.filter((r) => r.status === "aguardando_aprovacao");

  const missaoPorId = useMemo(() => {
    const mapa = new Map<string, Mission>();
    for (const m of store.missoes) mapa.set(m.id, m);
    return mapa;
  }, [store.missoes]);

  const podeExecutar = podeFazer("missao:executar");
  const podeCancelar = podeFazer("missao:cancelar");
  const podeAprovar = podeFazer("missao:aprovar");

  const enfileirar = () => {
    const missao = store.missoes.find((m) => m.id === missaoId);
    if (!missao) {
      setMensagem("Selecione uma missão para enfileirar.");
      return;
    }
    const { run } = prepararRunDeMissao(state, missao, criticidade);
    dispatch({ type: "run/enfileirar", payload: { run, permissao: "missao:executar" } });
    setMensagem(`Execução da missão ${missao.codigo} enfileirada.`);
  };

  const processar = () => {
    dispatch({ type: "run/processar", payload: { config, missoes: store.missoes } });
    setMensagem("A fila foi processada pelo motor (timeout, dependências, concorrência e aprovação).");
  };

  const executarLocal = (runId: string, missaoId: string) => {
    const missao = missaoPorId.get(missaoId);
    if (!missao) {
      setMensagem("Missão não encontrada para execução local.");
      return;
    }
    const resultado = executarLocalmente(missionParaView(missao));
    dispatch({ type: "run/concluir", payload: { id: runId, resultado } });
    setMensagem("Execução local real concluída e registrada.");
  };

  const registrarFalha = (runId: string) => {
    dispatch({ type: "run/falhar", payload: { id: runId, erro: "Falha reportada pelo operador" } });
    setMensagem("Falha registrada. Retentativa controlada aplicada conforme o limite de tentativas.");
  };

  const cancelar = (runId: string) => {
    dispatch({ type: "run/cancelar", payload: { id: runId } });
  };

  const decidir = (runId: string, aprovado: boolean) => {
    dispatch({ type: "run/aprovar", payload: { id: runId, aprovado } });
  };

  return (
    <div className="fire-page fire-page--orquestracao space-y-5"><section className="glass fire-flow p-4" aria-label="Fluxo operacional ilustrativo"><p className="fire-eyebrow">PIPELINE / EXECUÇÃO LOCAL</p><div className="fire-flow-track">{["Missão","Fila","Aprovação quando exigida","Executor local","Evidências"].map((step,i)=><div key={step} className="fire-flow-node"><span>{String(i+1).padStart(2,"0")}</span>{step}</div>)}</div><p className="text-xs text-slate-400">Fluxo conceitual; consulte a fila abaixo para o estado real.</p></section>
      <div className="glass flex items-start gap-3 border-cyan-400/30 bg-cyan-400/[0.06] p-4">
        <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <h2 className="text-sm font-semibold text-cyan-100">
            Motor de orquestração local — fila, prioridades, dependências e estado
          </h2>
          <p className="mt-1 text-sm text-cyan-200/80">
            Operações externas permanecem bloqueadas. A única execução automática é a execução local
            determinística (não é IA). Operações críticas exigem aprovação humana antes de iniciar.
          </p>
        </div>
      </div>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Gauge className="h-4 w-4 text-fire-soft" />
          Limites de execução
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="label">Concorrência</span>
            <input
              type="number"
              min={1}
              max={10}
              className="field"
              value={config.maxConcorrencia}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxConcorrencia: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </label>
          <label className="block">
            <span className="label">Timeout (ms)</span>
            <input
              type="number"
              min={1000}
              step={1000}
              className="field"
              value={config.timeoutMs}
              onChange={(e) =>
                setConfig((c) => ({ ...c, timeoutMs: Math.max(1000, Number(e.target.value) || 1000) }))
              }
            />
          </label>
          <label className="block">
            <span className="label">Máx. tentativas</span>
            <input
              type="number"
              min={1}
              max={5}
              className="field"
              value={config.maxTentativas}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxTentativas: Math.max(1, Number(e.target.value) || 1) }))
              }
            />
          </label>
          <div className="glass-soft flex flex-col justify-center p-3">
            <span className="text-xs uppercase tracking-wider text-slate-400">Externas</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" />
              Bloqueadas
            </span>
          </div>
        </div>
      </section>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Plus className="h-4 w-4 text-fire-soft" />
          Enfileirar missão
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="label">Missão</span>
            <select className="field" value={missaoId} onChange={(e) => setMissaoId(e.target.value)}>
              <option value="">Selecione uma missão</option>
              {store.missoes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Criticidade</span>
            <select
              className="field"
              value={criticidade}
              onChange={(e) => setCriticidade(e.target.value as "normal" | "critica")}
            >
              <option value="normal">Normal</option>
              <option value="critica">Crítica (exige aprovação)</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" onClick={enfileirar} disabled={!podeExecutar || !missaoId}>
            <Plus className="h-4 w-4" />
            Enfileirar
          </button>
          <button type="button" className="btn-ghost" onClick={processar}>
            <RefreshCw className="h-4 w-4" />
            Processar fila
          </button>
          {!podeExecutar && (
            <span className="text-xs text-amber-200">
              Seu papel atual não possui a permissão “missao:executar”.
            </span>
          )}
        </div>
        {mensagem && <p className="mt-3 text-sm text-slate-300">{mensagem}</p>}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="glass flex items-center gap-3 p-4">
          <ListChecks className="h-5 w-5 text-fire-soft" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Fila</p>
            <p className="text-lg font-semibold text-slate-100">{resumo.length}</p>
          </div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <Play className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Em execução</p>
            <p className="text-lg font-semibold text-slate-100">
              {executando.length} / {config.maxConcorrencia}
            </p>
          </div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <BadgeCheck className="h-5 w-5 text-amber-300" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Aguardando aprovação</p>
            <p className="text-lg font-semibold text-slate-100">{pendentesAprovacao.length}</p>
          </div>
        </div>
      </div>

      {pendentesAprovacao.length > 0 && (
        <section className="glass border-amber-400/30 bg-amber-400/[0.05] p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-100">
            <BadgeCheck className="h-4 w-4" />
            Operações críticas aguardando aprovação humana
          </h3>
          <ul className="mt-3 space-y-2">
            {pendentesAprovacao.map((run) => (
              <li key={run.id} className="glass-soft flex flex-wrap items-center gap-3 p-3">
                <RunStatusBadge status={run.status} />
                <span className="font-mono text-xs text-slate-300">{run.missaoCodigo}</span>
                <span className="text-xs text-slate-500">
                  solicitada em {dateFormatter.format(new Date(run.atualizadoEm))}
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    className="btn-primary !py-1.5 !text-xs"
                    onClick={() => decidir(run.id, true)}
                    disabled={!podeAprovar}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn-danger !py-1.5 !text-xs"
                    onClick={() => decidir(run.id, false)}
                    disabled={!podeAprovar}
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Rejeitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <ListChecks className="h-4 w-4 text-fire-soft" />
          Fila ordenada (prioridade e ordem de criação)
        </h3>
        {fila.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma execução aguardando na fila.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {fila.map((run, indice) => (
              <li key={run.id} className="glass-soft flex flex-wrap items-center gap-3 p-3">
                <span className="text-xs text-slate-500">#{indice + 1}</span>
                <span className="font-mono text-xs text-slate-300">{run.missaoCodigo}</span>
                <PriorityBadge prioridade={run.prioridade} />
                <RunStatusBadge status={run.status} />
                {run.criticidade === "critica" && (
                  <span className="chip border-rose-400/30 bg-rose-400/10 text-rose-200">Crítica</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-100">Execuções ({runs.length})</h3>
        {runs.length === 0 ? (
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title="Nenhuma execução registrada"
            description="Enfileire uma missão e processe a fila para acompanhar o ciclo completo de execução."
          />
        ) : (
          <div className="mt-3 space-y-3">
            {runs.map((run) => (
              <article key={run.id} className="glass-soft p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-slate-200">{run.missaoCodigo}</span>
                  <RunStatusBadge status={run.status} />
                  <PriorityBadge prioridade={run.prioridade} />
                  <span className="text-xs text-slate-500">
                    tentativa {run.tentativaAtual}/{config.maxTentativas}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">
                    {dateFormatter.format(new Date(run.atualizadoEm))}
                  </span>
                </div>

                {run.erro && <p className="mt-2 text-xs text-rose-300">Erro: {run.erro}</p>}

                {run.eventos.length > 0 && (
                  <ol className="mt-2 space-y-1 border-l border-white/10 pl-4">
                    {[...run.eventos].reverse().slice(0, 4).map((ev) => (
                      <li key={ev.id} className="text-xs text-slate-400">
                        <span className="text-slate-500">
                          {dateFormatter.format(new Date(ev.timestamp))} ·{" "}
                        </span>
                        {RUN_STATUS_LABEL[ev.status]} — {ev.descricao}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                  {run.status === "executando" && (
                    <>
                      <button
                        type="button"
                        className="btn-primary !py-1.5 !text-xs"
                        onClick={() => executarLocal(run.id, run.missaoId)}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Executar localmente (real)
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !py-1.5 !text-xs"
                        onClick={() => registrarFalha(run.id)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Registrar falha
                      </button>
                    </>
                  )}
                  {run.status === "aguardando_aprovacao" && (
                    <>
                      <button
                        type="button"
                        className="btn-primary !py-1.5 !text-xs"
                        onClick={() => decidir(run.id, true)}
                        disabled={!podeAprovar}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        className="btn-danger !py-1.5 !text-xs"
                        onClick={() => decidir(run.id, false)}
                        disabled={!podeAprovar}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Rejeitar
                      </button>
                    </>
                  )}
                  {!["concluida", "falhou", "cancelada", "expirada"].includes(run.status) && (
                    <button
                      type="button"
                      className="btn-ghost !py-1.5 !text-xs"
                      onClick={() => cancelar(run.id)}
                      disabled={!podeCancelar}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
