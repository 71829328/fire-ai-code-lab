import { useState } from "react";
import { CheckCircle2, Clock, Cpu, Hash, Play, Terminal, XCircle } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { runLocalDemoTask } from "../domain/localExecutor";
import type { LocalExecution } from "../types";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function Metrica({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="fire-page fire-page--executor glass-soft p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{valor}</p>
    </div>
  );
}

export function LocalExecutor() {
  const { state, dispatch } = useStore();
  const [texto, setTexto] = useState("");
  const [missaoId, setMissaoId] = useState("");
  const [resultado, setResultado] = useState<LocalExecution | null>(null);

  const missaoSelecionada = state.missoes.find((missao) => missao.id === missaoId) ?? null;
  const criterios = missaoSelecionada?.criteriosAceite ?? [];

  const codigoMissao = (id: string | null) =>
    id ? state.missoes.find((missao) => missao.id === id)?.codigo ?? "—" : "Demonstração";

  const executar = () => {
    if (texto.trim().length === 0) return;
    const execucao = runLocalDemoTask({
      texto,
      missaoId: missaoId || null,
      criterios,
    });
    dispatch({ type: "execucao/registrar", payload: execucao });
    setResultado(execucao);
  };

  return (
    <div className="fire-page fire-page--executor space-y-5">
      <div className="glass flex items-start gap-3 border-cyan-400/30 bg-cyan-400/[0.06] p-4">
        <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
        <div>
          <h2 className="text-sm font-semibold text-cyan-100">
            Execução LOCAL determinística e verificável
          </h2>
          <p className="mt-1 text-sm text-cyan-200/80">
            Executada inteiramente no navegador. Isto NÃO é execução por IA e NÃO usa APIs externas.
          </p>
        </div>
      </div>

      <section className="glass p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="label" htmlFor="exec-texto">
              Texto de entrada
            </label>
            <textarea
              id="exec-texto"
              className="field min-h-[140px]"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Cole aqui o texto a ser analisado localmente..."
            />
          </div>
          <div>
            <label className="label" htmlFor="exec-missao">
              Missão vinculada (opcional)
            </label>
            <select
              id="exec-missao"
              className="field"
              value={missaoId}
              onChange={(event) => setMissaoId(event.target.value)}
            >
              <option value="">Sem vínculo</option>
              {state.missoes.map((missao) => (
                <option key={missao.id} value={missao.id}>
                  {missao.codigo} — {missao.titulo}
                </option>
              ))}
            </select>
            {missaoSelecionada && (
              <p className="mt-2 text-xs text-slate-400">
                {criterios.length} critério(s) de aceite serão considerados na execução.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={executar}
            disabled={texto.trim().length === 0}
          >
            <Play className="h-4 w-4" />
            Executar localmente
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5" />
            Processamento 100% no navegador
          </span>
        </div>
      </section>

      {resultado && (
        <section className="glass animate-fade-up p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-100">Resultado da execução</h2>
            <span className="chip border-white/10 bg-white/5 text-slate-300">modo: local</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metrica label="Caracteres" valor={resultado.saida.caracteres} />
            <Metrica label="Palavras" valor={resultado.saida.palavras} />
            <Metrica label="Linhas" valor={resultado.saida.linhas} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="glass-soft flex items-center gap-2 p-3">
              <Hash className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-slate-400">Checksum</p>
                <p className="truncate font-mono text-sm text-slate-100">{resultado.checksum}</p>
              </div>
            </div>
            <div className="glass-soft flex items-center gap-2 p-3">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Duração</p>
                <p className="text-sm text-slate-100">{resultado.duracaoMs} ms</p>
              </div>
            </div>
          </div>

          <div
            className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${
              resultado.verificacao.passou
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/30 bg-rose-400/10 text-rose-200"
            }`}
          >
            {resultado.verificacao.passou ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div>
              <p className="font-semibold">
                {resultado.verificacao.passou ? "Verificação aprovada" : "Verificação com divergência"}
              </p>
              <p className="mt-0.5 text-xs opacity-90">{resultado.verificacao.detalhe}</p>
            </div>
          </div>

          <p className="mt-3 text-sm text-slate-400">{resultado.saida.resumo}</p>
        </section>
      )}

      <section className="glass p-5">
        <h2 className="text-sm font-semibold text-slate-100">Execuções recentes</h2>
        {state.execucoes.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nenhuma execução local registrada.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {state.execucoes.map((execucao) => (
              <li
                key={execucao.id}
                className="glass-soft flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"
              >
                {execucao.verificacao.passou ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-rose-300" />
                )}
                <span className="font-mono text-xs text-slate-300">{execucao.checksum}</span>
                <span
                  className={
                    execucao.verificacao.passou ? "text-emerald-300" : "text-rose-300"
                  }
                >
                  {execucao.verificacao.passou ? "Passou" : "Falhou"}
                </span>
                <span className="text-slate-400">
                  {execucao.missaoId
                    ? `Missão ${codigoMissao(execucao.missaoId)}`
                    : "Sem missão vinculada"}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {dateFormatter.format(new Date(execucao.timestamp))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
