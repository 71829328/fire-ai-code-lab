import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import {
  BACKUP_APLICACAO,
  parseBackup,
  serializarBackup,
  type BackupParseResult,
} from "../domain/backup";
import type { AppState } from "../types";

// Gera o arquivo e dispara o download no navegador via Blob + URL temporária.
function baixarArquivo(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function contarRegistros(state: AppState): number {
  return (
    state.agentes.length +
    state.projetos.length +
    state.tarefas.length +
    state.missoes.length +
    state.integracoes.length +
    state.execucoes.length +
    state.atividades.length
  );
}

const dataFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function DataBackup() {
  const { state, dispatch, persistencia, carga } = useStore();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [resultado, setResultado] = useState<BackupParseResult | null>(null);
  const [textoColado, setTextoColado] = useState("");
  const [erroLeitura, setErroLeitura] = useState("");
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false);

  // Só permite aplicar quando o conteúdo passou pela validação de parseBackup.
  const estadoImportavel = resultado?.state ?? null;

  const resumo = [
    { label: "Agentes", valor: state.agentes.length },
    { label: "Projetos", valor: state.projetos.length },
    { label: "Tarefas", valor: state.tarefas.length },
    { label: "Missões", valor: state.missoes.length },
    { label: "Integrações", valor: state.integracoes.length },
    { label: "Execuções", valor: state.execucoes.length },
    { label: "Atividades", valor: state.atividades.length },
  ];

  const exportar = () => {
    const data = new Date().toISOString().slice(0, 10);
    baixarArquivo(`fire-command-center-backup-${data}.json`, serializarBackup(state));
  };

  const lerArquivo = async (arquivo: File) => {
    setErroLeitura("");
    try {
      const texto = await arquivo.text();
      setResultado(parseBackup(texto));
    } catch {
      setResultado(null);
      setErroLeitura("Não foi possível ler o arquivo selecionado. Verifique se ele é um JSON válido.");
    }
  };

  const validarColado = () => {
    setErroLeitura("");
    setResultado(parseBackup(textoColado));
  };

  return (
    <div className="fire-page fire-page--dados space-y-5">
      {/* Persistência atual + issues de carga */}
      <section className="glass p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <HardDriveDownload className="h-4 w-4 text-fire" />
          Persistência local
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          <span
            className={`chip mr-2 ${
              persistencia.status === "ok"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {persistencia.status}
          </span>
          {persistencia.mensagem}
        </p>
        {carga.issues.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Ajustes ao carregar os dados
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-200/90">
              {carga.issues.map((issue, index) => (
                <li key={`${issue.caminho}-${index}`}>
                  <span className="font-mono text-xs">{issue.caminho}</span>: {issue.mensagem}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Resumo do estado atual */}
      <section className="glass p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Database className="h-4 w-4 text-cyan-300" />
          Resumo do estado atual
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7 stagger">
          {resumo.map((item) => (
            <div key={item.label} className="glass-soft px-3 py-3 text-center">
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</dt>
              <dd className="text-xl font-bold text-slate-100">{item.valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Exportar */}
        <section className="glass flex flex-col p-5">
          <h2 className="text-sm font-semibold text-slate-100">Exportar backup</h2>
          <p className="mt-1 text-sm text-slate-400">
            Gera um arquivo versionado (<span className="font-mono text-xs">{BACKUP_APLICACAO}</span>)
            com todo o estado atual desta aplicação.
          </p>
          <button type="button" className="btn-primary mt-4 self-start" onClick={exportar}>
            <Download className="h-4 w-4" />
            Exportar backup
          </button>
        </section>

        {/* Importar por arquivo */}
        <section className="glass flex flex-col p-5">
          <h2 className="text-sm font-semibold text-slate-100">Importar de arquivo</h2>
          <p className="mt-1 text-sm text-slate-400">
            O conteúdo é validado antes de qualquer aplicação.
          </p>
          <label className="label mt-4" htmlFor="backup-arquivo">
            Arquivo JSON
          </label>
          <input
            id="backup-arquivo"
            ref={inputArquivo}
            type="file"
            accept=".json,application/json"
            className="field file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-slate-100"
            onChange={(event) => {
              const arquivo = event.target.files?.[0];
              if (arquivo) void lerArquivo(arquivo);
            }}
          />
          <label className="label mt-4" htmlFor="backup-colado">
            Ou cole o JSON
          </label>
          <textarea
            id="backup-colado"
            className="field min-h-[120px] font-mono text-xs"
            value={textoColado}
            onChange={(event) => setTextoColado(event.target.value)}
            placeholder='{"aplicacao":"fire-agent-command-center", ...}'
          />
          <button
            type="button"
            className="btn-ghost mt-3 self-start"
            onClick={validarColado}
            disabled={!textoColado.trim()}
          >
            <ShieldCheck className="h-4 w-4" />
            Validar conteúdo colado
          </button>
        </section>
      </div>

      {erroLeitura && (
        <p className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4" />
          {erroLeitura}
        </p>
      )}

      {/* Relatório de validação */}
      {resultado && (
        <section className="glass p-5 animate-fade-up">
          <h2 className="text-sm font-semibold text-slate-100">Relatório de validação</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-slate-400">Meta:</dt>
              <dd className="text-slate-200">
                {resultado.meta
                  ? `gerado em ${
                      resultado.meta.geradoEm
                        ? dataFormatter.format(new Date(resultado.meta.geradoEm))
                        : "data desconhecida"
                    } · versão ${resultado.meta.versao ?? "desconhecida"}`
                  : "envelope ausente (estado cru)"}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-slate-400">Registros válidos:</dt>
              <dd className="text-slate-200">
                {estadoImportavel ? contarRegistros(estadoImportavel) : 0}
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-slate-400">Descartados:</dt>
              <dd className="text-slate-200">{resultado.descartados}</dd>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <dt className="text-slate-400">Migração:</dt>
              <dd className="text-slate-200">
                {resultado.migrado ? "sim, formato anterior migrado" : "não"}
              </dd>
            </div>
          </dl>

          {resultado.issues.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">Ocorrências ({resultado.issues.length})</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-amber-200/90">
                {resultado.issues.map((issue, index) => (
                  <li key={`${issue.caminho}-${index}`}>
                    <span className="font-mono text-xs">{issue.caminho}</span>: {issue.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {estadoImportavel ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conteúdo válido
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setConfirmarAplicar(true)}
              >
                <Upload className="h-4 w-4" />
                Aplicar backup
              </button>
            </div>
          ) : (
            <p className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <AlertTriangle className="h-4 w-4" />
              Conteúdo inválido: o backup não pode ser aplicado.
            </p>
          )}
        </section>
      )}

      {/* Restaurar dados demonstrativos */}
      <section className="glass flex flex-col p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <RefreshCw className="h-4 w-4 text-violet-300" />
          Restaurar dados demonstrativos
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Substitui o estado atual pelo conjunto de exemplo original.
        </p>
        <button
          type="button"
          className="btn-danger mt-4 self-start"
          onClick={() => setConfirmarRestaurar(true)}
        >
          <RefreshCw className="h-4 w-4" />
          Restaurar dados demonstrativos
        </button>
      </section>

      <ConfirmDialog
        open={confirmarAplicar}
        title="Aplicar backup?"
        description="Isto substitui TODOS os dados atuais pelos do arquivo validado. A ação não pode ser desfeita."
        confirmLabel="Aplicar backup"
        tone="danger"
        onConfirm={() => {
          if (estadoImportavel) {
            dispatch({ type: "estado/importar", payload: estadoImportavel });
          }
          setConfirmarAplicar(false);
          setResultado(null);
          setTextoColado("");
          if (inputArquivo.current) inputArquivo.current.value = "";
        }}
        onCancel={() => setConfirmarAplicar(false)}
      />

      <ConfirmDialog
        open={confirmarRestaurar}
        title="Restaurar dados demonstrativos?"
        description="Isto substitui TODOS os dados atuais pelo conjunto de exemplo original. A ação não pode ser desfeita."
        confirmLabel="Restaurar"
        tone="danger"
        onConfirm={() => {
          dispatch({ type: "estado/resetar" });
          setConfirmarRestaurar(false);
        }}
        onCancel={() => setConfirmarRestaurar(false)}
      />
    </div>
  );
}
