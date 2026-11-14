import { PageIdentity } from "../components/ui/PageIdentity";
import { useMemo, useState } from "react";
import {
  Boxes,
  Download,
  Plug,
  Send,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { useOps } from "../platform/OpsContext";
import { listarAdaptadores } from "../adapters/registry";
import { ADAPTER_CAPABILITY_LABEL } from "../adapters/types";
import { exportarMissao, importarResultado, type ResultadoImportado } from "../adapters/manualFlow";
import { INTEGRACOES_PENDENTES } from "../adapters/capabilities";
import { AdapterStatusBadge } from "../components/ui/opsBadges";
import { CopyButton } from "../components/ui/CopyButton";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function AgentAdapters() {
  const { state: store } = useStore();
  const { state, dispatch, podeFazer } = useOps();
  const adaptadores = useMemo(() => listarAdaptadores(), []);

  const [missaoId, setMissaoId] = useState("");
  const [envioMsg, setEnvioMsg] = useState<string | null>(null);
  const [textoImportado, setTextoImportado] = useState("");
  const [importado, setImportado] = useState<ResultadoImportado | null>(null);
  const [erroImport, setErroImport] = useState("");

  const missao = store.missoes.find((m) => m.id === missaoId) ?? null;
  const exportacao = useMemo(
    () =>
      missao
        ? exportarMissao(missao, {
            agenteNome: store.agentes.find((a) => a.id === missao.agenteId)?.nome ?? null,
            projetoNome: store.projetos.find((p) => p.id === missao.projetoId)?.nome ?? null,
          })
        : null,
    [missao, store.agentes, store.projetos]
  );

  const tentarEnvio = (adapterId: string) => {
    if (!missao) {
      setEnvioMsg("Selecione uma missão primeiro.");
      return;
    }
    const adapter = adaptadores.find((a) => a.descriptor.id === adapterId);
    if (!adapter) return;
    const submissao = adapter.enviarMissao({
      missao: {
        id: missao.id,
        codigo: missao.codigo,
        titulo: missao.titulo,
        prioridade: missao.prioridade,
        status: missao.status,
        dependencias: missao.dependencias,
        agenteId: missao.agenteId,
        instrucoes: missao.instrucoes,
        criteriosAceite: missao.criteriosAceite,
      },
      prompt: exportacao?.prompt ?? "",
    });
    setEnvioMsg(
      `Envio automático recusado conforme esperado (modo: ${submissao.modo}). ${submissao.mensagem}`
    );
  };

  const processarImportacao = () => {
    try {
      const resultado = importarResultado(textoImportado);
      setImportado(resultado);
      setErroImport("");
    } catch (e) {
      setImportado(null);
      setErroImport(e instanceof Error ? e.message : "Não foi possível interpretar o texto.");
    }
  };

  const registrarEvidencia = () => {
    if (!importado) return;
    dispatch({
      type: "evidencia/adicionar",
      payload: {
        missaoId: missaoId || null,
        runId: null,
        tipo: "relatorio",
        referencia: `Importação manual — ${missao?.codigo ?? "sem missão"}`,
        descricao: importado.resumo,
        valor: importado.artefatos.map((a) => `${a.nome}: ${a.valor}`).join(" | "),
        origemDado: "informado_agente",
        registradoPor: state.platform.usuarioAtivoId || null,
        verificadoPor: null,
        verificadoEm: null,
      },
    });
  };

  const podeRegistrarEvidencia = podeFazer("evidencia:registrar");

  return (
    <div className="fire-page fire-page--adaptadores space-y-5">
      <PageIdentity page="adaptadores" />
      <div className="glass flex items-start gap-3 border-amber-400/30 bg-amber-400/[0.06] p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            Nenhuma integração externa está autorizada neste ambiente
          </h2>
          <p className="mt-1 text-sm text-amber-200/80">
            Nenhuma API, endpoint ou capacidade é inventada. Adaptadores externos recusam o envio
            automático e direcionam para o fluxo manual assistido, que é o único caminho realmente
            disponível hoje.
          </p>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3 stagger">
        {adaptadores.map((adapter) => {
          const disp = adapter.validarDisponibilidade();
          const consumo = adapter.controleConsumo();
          return (
            <article key={adapter.descriptor.id} className="glass glass-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-slate-50">
                    <Plug className="h-4 w-4 text-fire-soft" />
                    {adapter.descriptor.nome}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">{adapter.descriptor.descricao}</p>
                </div>
                <AdapterStatusBadge status={disp.status} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {adapter.descriptor.capacidades.map((cap) => (
                  <span key={cap} className="chip border-white/10 bg-white/5 text-slate-300">
                    {ADAPTER_CAPABILITY_LABEL[cap]}
                  </span>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-400">{disp.motivo}</p>
              <p className="mt-1 text-xs text-slate-500">
                Consumo: {consumo.unidade} — {consumo.observacao}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Verificado em: {disp.verificadoEm ? dateFormatter.format(new Date(disp.verificadoEm)) : "nunca"}
              </p>

              {adapter.descriptor.requerimentos.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Requer para ativar
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {adapter.descriptor.requerimentos.map((req) => (
                      <li key={req} className="text-xs text-slate-400">
                        • {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 border-t border-white/10 pt-3">
                <button
                  type="button"
                  className="btn-ghost !py-1.5 !text-xs"
                  onClick={() => tentarEnvio(adapter.descriptor.id)}
                >
                  <Send className="h-3.5 w-3.5" />
                  Tentar envio automático
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {envioMsg && (
        <div className="glass border-amber-400/30 bg-amber-400/[0.05] p-4 text-sm text-amber-200">
          {envioMsg}
        </div>
      )}

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Boxes className="h-4 w-4 text-fire-soft" />
          Fluxo manual assistido — exportar missão
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="block lg:col-span-1">
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
          <div className="lg:col-span-2">
            <span className="label">Prompt exportável</span>
            {exportacao ? (
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton texto={exportacao.prompt} label="Copiar prompt" />
                <a
                  className="btn-ghost !py-1.5 !text-xs"
                  href={`data:text/markdown;charset=utf-8,${encodeURIComponent(exportacao.prompt)}`}
                  download={exportacao.nomeArquivo}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar {exportacao.nomeArquivo}
                </a>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Selecione uma missão para gerar o prompt.</p>
            )}
          </div>
        </div>
        {exportacao && (
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-night-900/70 p-3 text-xs text-slate-300">
            {exportacao.prompt}
          </pre>
        )}
      </section>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Upload className="h-4 w-4 text-fire-soft" />
          Fluxo manual assistido — importar resultado
        </h3>
        <div className="mt-3">
          <label className="label" htmlFor="import-resultado">
            Texto do resultado
          </label>
          <textarea
            id="import-resultado"
            className="field min-h-[140px]"
            value={textoImportado}
            onChange={(e) => setTextoImportado(e.target.value)}
            placeholder={"Ex.:\nResumo do trabalho concluído\ncommit: abc1234\nPR: https://exemplo/123"}
          />
        </div>
        {erroImport && <p className="mt-2 text-sm text-rose-300">{erroImport}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={processarImportacao}>
            <Upload className="h-4 w-4" />
            Interpretar resultado
          </button>
          {importado && (
            <button
              type="button"
              className="btn-ghost"
              onClick={registrarEvidencia}
              disabled={!podeRegistrarEvidencia}
            >
              Registrar como evidência (informada)
            </button>
          )}
        </div>

        {importado && (
          <div className="mt-4 glass-soft p-3">
            <p className="text-sm text-slate-200">{importado.resumo}</p>
            <p className="mt-2 text-xs uppercase tracking-wider text-slate-500">
              Artefatos extraídos ({importado.artefatos.length})
            </p>
            <ul className="mt-1 space-y-0.5">
              {importado.artefatos.map((art, i) => (
                <li key={`${art.nome}-${i}`} className="text-xs text-slate-300">
                  <span className="text-slate-500">{art.nome}: </span>
                  <span className="break-all">{art.valor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-100">Integrações pendentes de autorização</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTEGRACOES_PENDENTES.map((id) => (
            <span key={id} className="chip border-amber-400/30 bg-amber-400/10 text-amber-200">
              {id}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Disponíveis sem credencial de terceiros: agentes personalizados (cadastro do operador) e o
          executor local determinístico.
        </p>
      </section>
    </div>
  );
}
