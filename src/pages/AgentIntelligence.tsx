import { useMemo, useState } from "react";
import { ArrowUpDown, Award, Bot, Gauge, Info, Star } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { useOps } from "../platform/OpsContext";
import { calcularMetricasTodos, calcularEspecialidades } from "../intelligence/metrics";
import { recomendarAgentes, type AgenteRecomendavel } from "../intelligence/recommendation";
import { PAPEL_LABEL } from "../platform/types";
import { EmptyState } from "../components/ui/EmptyState";

function formatarTempo(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

const confiancaLabel: Record<string, string> = {
  alta: "Confiança alta",
  media: "Confiança média",
  baixa: "Confiança baixa",
  sem_dados: "Sem dados",
};

const confiancaStyle: Record<string, string> = {
  alta: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  media: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  baixa: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  sem_dados: "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

export function AgentIntelligence() {
  const { state: store } = useStore();
  const { state } = useOps();
  const [ordem, setOrdem] = useState<"nome" | "sucesso" | "concluidas">("sucesso");

  const { runs, evidencias, consumo } = useMemo(
    () => ({
      runs: state.runs,
      evidencias: state.platform.evidencias,
      consumo: state.platform.consumo,
    }),
    [state]
  );

  const metricas = useMemo(
    () =>
      calcularMetricasTodos({
        agentes: store.agentes.map((a) => ({ id: a.id, nome: a.nome })),
        runs,
        evidencias,
        consumo,
      }),
    [store.agentes, runs, evidencias, consumo]
  );

  const recomendacoes = useMemo(() => {
    const agentes: AgenteRecomendavel[] = store.agentes.map((a) => ({
      id: a.id,
      nome: a.nome,
      papel: a.papel,
      conexao: a.conexao,
    }));
    return recomendarAgentes({ agentes, runs, evidencias, consumo });
  }, [store.agentes, runs, evidencias, consumo]);

  const ordenadas = useMemo(() => {
    const copia = [...metricas];
    if (ordem === "nome") copia.sort((a, b) => a.nome.localeCompare(b.nome));
    if (ordem === "concluidas")
      copia.sort((a, b) => b.metricas.missoesConcluidas - a.metricas.missoesConcluidas);
    if (ordem === "sucesso")
      copia.sort(
        (a, b) => (b.metricas.taxaSucesso ?? -1) - (a.metricas.taxaSucesso ?? -1)
      );
    return copia;
  }, [metricas, ordem]);

  const especialidadesVerificadas = useMemo(() => calcularEspecialidades(evidencias), [evidencias]);
  const temDados = runs.length > 0;

  return (
    <div className="fire-page fire-page--inteligencia space-y-5">
      <div className="glass flex items-start gap-3 border-cyan-400/30 bg-cyan-400/[0.06] p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <h2 className="text-sm font-semibold text-cyan-100">
            Desempenho calculado apenas com dados observados
          </h2>
          <p className="mt-1 text-sm text-cyan-200/80">
            Nenhum índice é estimado ou preenchido artificialmente. Um agente sem execuções registradas
            aparece como “Sem dados”, nunca com desempenho inventado.
          </p>
        </div>
      </div>

      {!temDados && (
        <div className="glass border-amber-400/30 bg-amber-400/[0.05] p-4 text-sm text-amber-200">
          Ainda não há execuções no motor. Enfileire e processe missões em “Orquestração” para gerar
          métricas reais.
        </div>
      )}

      <section className="glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Award className="h-4 w-4 text-fire-soft" />
            Recomendação por dados reais
          </h3>
          <span className="text-xs text-slate-500">
            Seleção manual continua disponível em toda a central.
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {recomendacoes.map((rec, indice) => (
            <li key={rec.agenteId} className="glass-soft flex flex-wrap items-center gap-3 p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-slate-300">
                {indice + 1}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                  <Bot className="h-4 w-4 text-cyan-300" />
                  {rec.nome}
                </p>
                <p className="text-xs text-slate-400">{rec.justificativa}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {rec.pontuacao > 0 && (
                  <span className="chip border-fire/40 bg-fire/10 text-fire-soft">
                    <Star className="h-3 w-3" aria-hidden />
                    {rec.pontuacao.toFixed(2)}
                  </span>
                )}
                <span className={`chip ${confiancaStyle[rec.confianca]}`}>
                  {confiancaLabel[rec.confianca]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Gauge className="h-4 w-4 text-fire-soft" />
            Métricas por agente
          </h3>
          <button
            type="button"
            className="btn-ghost !py-1.5 !text-xs"
            onClick={() => setOrdem((o) => (o === "sucesso" ? "concluidas" : o === "concluidas" ? "nome" : "sucesso"))}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            Ordenar: {ordem === "sucesso" ? "sucesso" : ordem === "concluidas" ? "concluídas" : "nome"}
          </button>
        </div>

        {ordenadas.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-5 w-5" />}
            title="Nenhum agente cadastrado"
            description="Cadastre agentes para acompanhar métricas operacionais."
          />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Agente</th>
                  <th className="py-2 pr-3 font-semibold">Papel</th>
                  <th className="py-2 pr-3 font-semibold">Concluídas</th>
                  <th className="py-2 pr-3 font-semibold">Falhas</th>
                  <th className="py-2 pr-3 font-semibold">Taxa de sucesso</th>
                  <th className="py-2 pr-3 font-semibold">Tempo médio</th>
                  <th className="py-2 pr-3 font-semibold">Erros</th>
                  <th className="py-2 pr-3 font-semibold">Testes</th>
                  <th className="py-2 pr-3 font-semibold">Retrabalho</th>
                  <th className="py-2 font-semibold">Consumo</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((linha) => {
                  const m = linha.metricas;
                  const agente = store.agentes.find((a) => a.id === linha.agenteId);
                  return (
                    <tr key={linha.agenteId} className="border-b border-white/5 text-slate-300">
                      <td className="py-2 pr-3 font-semibold text-slate-100">{linha.nome}</td>
                      <td className="py-2 pr-3 text-xs text-slate-400">
                        {agente ? PAPEL_LABEL[agente.papel as keyof typeof PAPEL_LABEL] ?? agente.papel : "—"}
                      </td>
                      <td className="py-2 pr-3">{m.missoesConcluidas}</td>
                      <td className="py-2 pr-3">{m.missoesFalhadas}</td>
                      <td className="py-2 pr-3">
                        {m.taxaSucesso === null ? "—" : `${Math.round(m.taxaSucesso * 100)}%`}
                      </td>
                      <td className="py-2 pr-3">{formatarTempo(m.tempoMedioMs)}</td>
                      <td className="py-2 pr-3">{m.erros}</td>
                      <td className="py-2 pr-3">{m.testesAprovados}</td>
                      <td className="py-2 pr-3">{m.retrabalho}</td>
                      <td className="py-2">{m.consumoInformado}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-slate-500">
          Especialidades derivadas apenas de evidências <strong>verificadas</strong>:{" "}
          {especialidadesVerificadas.length === 0
            ? "nenhuma comprovada independentemente ainda."
            : especialidadesVerificadas.join(", ")}
        </p>
      </section>
    </div>
  );
}
