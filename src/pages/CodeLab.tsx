import { useState } from "react";
import { AlertTriangle, Code2, FileCode2, Sparkles } from "lucide-react";
import { analyzeCode, type Analysis, type Severity } from "../analyzer";
import { CopyButton } from "../components/ui/CopyButton";
import { EmptyState } from "../components/ui/EmptyState";

// Trecho de exemplo que dispara as regras eval, secret, console, debugger e TODO.
const EXEMPLO = `// Exemplo para demonstrar a análise estática.
function executarEntrada(userInput) {
  eval(userInput);
  const apiKey = "123456789";
  console.log("processando entrada");
  debugger;
  // TODO: revisar esta função antes de publicar
}`;

const severidadeClasse: Record<Severity, string> = {
  high: "border-rose-500/30 bg-rose-500/10 text-rose-200",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  low: "border-slate-400/30 bg-slate-400/10 text-slate-300",
};

const severidadeLabel: Record<Severity, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export function CodeLab() {
  const [codigo, setCodigo] = useState("");
  const [analise, setAnalise] = useState<Analysis | null>(null);

  const analisar = () => setAnalise(analyzeCode(codigo));

  const corScore =
    analise && analise.score >= 80
      ? "bg-emerald-400"
      : analise && analise.score >= 50
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="space-y-5">
      <div className="glass flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <FileCode2 className="h-4 w-4 text-fire" />
            Código-fonte
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCodigo(EXEMPLO);
                setAnalise(null);
              }}
            >
              <Sparkles className="h-4 w-4" />
              Carregar exemplo
            </button>
            <button type="button" className="btn-primary" onClick={analisar}>
              <Code2 className="h-4 w-4" />
              Analisar código
            </button>
          </div>
        </div>

        <textarea
          className="field min-h-[220px] font-mono text-xs"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
          placeholder="Cole aqui o código para análise estática..."
          aria-label="Código-fonte para análise"
        />

        <p className="flex items-center gap-2 text-xs text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
          Este módulo apenas analisa o texto estaticamente; o código enviado NUNCA é executado.
        </p>
      </div>

      {analise === null ? (
        <EmptyState
          icon={<Code2 className="h-5 w-5" />}
          title="Nenhuma análise ainda"
          description="Cole um trecho de código e clique em “Analisar código”, ou carregue o exemplo para demonstrar."
          action={
            <button type="button" className="btn-primary" onClick={() => setCodigo(EXEMPLO)}>
              <Sparkles className="h-4 w-4" />
              Carregar exemplo
            </button>
          }
        />
      ) : (
        <>
          <section className="glass p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Pontuação
                </p>
                <p className="text-3xl font-bold text-slate-50">{analise.score}/100</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm text-slate-400">
                  <span className="font-semibold text-slate-100">{analise.lines}</span> linha(s)
                  analisada(s)
                </p>
                <CopyButton
                  texto={JSON.stringify(
                    { score: analise.score, lines: analise.lines, findings: analise.findings },
                    null,
                    2
                  )}
                  label="Copiar resultado"
                />
              </div>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${corScore}`}
                style={{ width: `${analise.score}%`, transition: "width 0.6s ease" }}
              />
            </div>
          </section>

          <section className="glass p-5">
            <h2 className="text-sm font-semibold text-slate-100">
              Achados ({analise.findings.length})
            </h2>

            {analise.findings.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">
                Nenhuma ocorrência detectada pelas regras estáticas.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {analise.findings.map((finding, index) => (
                  <li
                    key={`${finding.id}-${index}`}
                    className="glass-soft p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${severidadeClasse[finding.severity]}`}>
                        {severidadeLabel[finding.severity]}
                      </span>
                      <span className="text-xs text-slate-400">Linha {finding.line}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">{finding.message}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Sugestão: {finding.suggestion}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
