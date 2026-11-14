import { PageIdentity } from "../components/ui/PageIdentity";
import { useMemo, useState } from "react";
import { FileCheck2, Files, Link2, Plus, ShieldCheck, ShieldQuestion } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { useOps } from "../platform/OpsContext";
import {
  EVIDENCE_KIND_LABEL,
  ORIGEM_DADO_LABEL,
  type EvidenceKind,
  type EvidenceRecord,
} from "../platform/types";
import { resumirEvidencias, separarPorOrigem } from "../evidence/center";
import { EvidenceKindBadge, OrigemDadoBadge } from "../components/ui/opsBadges";
import { EmptyState } from "../components/ui/EmptyState";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const KINDS = Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[];

export function EvidenceCenter() {
  const { state: store } = useStore();
  const { state, dispatch, podeFazer } = useOps();

  const [tipo, setTipo] = useState<EvidenceKind>("commit");
  const [referencia, setReferencia] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [missaoId, setMissaoId] = useState("");
  const [erro, setErro] = useState("");
  const [verificadores, setVerificadores] = useState<Record<string, string>>({});

  const evidencias = state.platform.evidencias;
  const resumo = useMemo(() => resumirEvidencias(evidencias), [evidencias]);
  const { informadas, verificadas } = useMemo(() => separarPorOrigem(evidencias), [evidencias]);

  const podeRegistrar = podeFazer("evidencia:registrar");
  const podeVerificar = podeFazer("evidencia:verificar");

  const nomeMissao = (id: string | null) =>
    id ? store.missoes.find((m) => m.id === id)?.codigo ?? "—" : null;

  const adicionar = () => {
    if (!referencia.trim()) {
      setErro("Informe a referência (URL, hash, nome do arquivo...).");
      return;
    }
    if (!descricao.trim()) {
      setErro("Informe a descrição da evidência.");
      return;
    }
    dispatch({
      type: "evidencia/adicionar",
      payload: {
        missaoId: missaoId || null,
        runId: null,
        tipo,
        referencia: referencia.trim(),
        descricao: descricao.trim(),
        valor: valor.trim(),
        origemDado: "informado_agente",
        registradoPor: state.platform.usuarioAtivoId || null,
        verificadoPor: null,
        verificadoEm: null,
      },
    });
    setReferencia("");
    setDescricao("");
    setValor("");
    setErro("");
  };

  const verificar = (id: string) => {
    const nome = (verificadores[id] ?? "").trim();
    if (!nome) {
      setErro("Informe o nome de quem verificou independentemente.");
      return;
    }
    dispatch({ type: "evidencia/verificar", payload: { id, verificador: nome } });
    setVerificadores((atual) => ({ ...atual, [id]: "" }));
  };

  const Cartao = ({ ev }: { ev: EvidenceRecord }) => (
    <li className="glass-soft p-3">
      <div className="flex flex-wrap items-center gap-2">
        <EvidenceKindBadge tipo={ev.tipo} />
        <OrigemDadoBadge origem={ev.origemDado} />
        {nomeMissao(ev.missaoId) && (
          <span className="chip border-white/10 bg-white/5 text-slate-300">
            <Link2 className="h-3 w-3" aria-hidden />
            {nomeMissao(ev.missaoId)}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {dateFormatter.format(new Date(ev.timestamp))}
        </span>
      </div>
      <p className="mt-2 break-all text-sm text-slate-200">{ev.referencia}</p>
      <p className="mt-0.5 text-sm text-slate-400">{ev.descricao}</p>
      {ev.valor && <p className="mt-0.5 break-all text-xs text-slate-500">{ev.valor}</p>}
      {ev.origemDado === "verificado_independente" ? (
        <p className="mt-1 text-xs text-emerald-200">
          Verificada por {ev.verificadoPor} em{" "}
          {ev.verificadoEm ? dateFormatter.format(new Date(ev.verificadoEm)) : "—"}
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            className="field max-w-xs"
            placeholder="Nome do verificador independente"
            value={verificadores[ev.id] ?? ""}
            onChange={(e) => setVerificadores((a) => ({ ...a, [ev.id]: e.target.value }))}
          />
          <button
            type="button"
            className="btn-ghost !py-1.5 !text-xs"
            onClick={() => verificar(ev.id)}
            disabled={!podeVerificar}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verificar
          </button>
        </div>
      )}
    </li>
  );

  return (
    <div className="fire-page fire-page--evidencias space-y-5">
      <PageIdentity page="evidencias" />
      <div className="glass flex items-start gap-3 border-emerald-400/30 bg-emerald-400/[0.06] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
        <div>
          <h2 className="text-sm font-semibold text-emerald-100">
            Evidência informada ≠ evidência verificada
          </h2>
          <p className="mt-1 text-sm text-emerald-200/80">
            Evidências informadas pelo agente/operador ficam separadas das verificadas
            independentemente. Só é possível promover uma evidência com um verificador identificado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass flex items-center gap-3 p-4">
          <Files className="h-5 w-5 text-slate-300" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Total</p>
            <p className="text-lg font-semibold text-slate-100">{resumo.total}</p>
          </div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <ShieldQuestion className="h-5 w-5 text-cyan-300" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Informadas</p>
            <p className="text-lg font-semibold text-slate-100">{resumo.informadas}</p>
          </div>
        </div>
        <div className="glass flex items-center gap-3 p-4">
          <FileCheck2 className="h-5 w-5 text-emerald-300" />
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Verificadas</p>
            <p className="text-lg font-semibold text-slate-100">{resumo.verificadas}</p>
          </div>
        </div>
      </div>

      <section className="glass p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Plus className="h-4 w-4 text-fire-soft" />
          Registrar evidência
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Tipo</span>
            <select className="field" value={tipo} onChange={(e) => setTipo(e.target.value as EvidenceKind)}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {EVIDENCE_KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Missão (opcional)</span>
            <select className="field" value={missaoId} onChange={(e) => setMissaoId(e.target.value)}>
              <option value="">Sem vínculo</option>
              {store.missoes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.codigo} — {m.titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Referência</span>
            <input
              className="field"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="URL, hash, nome do arquivo..."
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Descrição</span>
            <input
              className="field"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="O que esta evidência comprova"
            />
          </label>
          <label className="block">
            <span className="label">Valor (opcional)</span>
            <input
              className="field"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Detalhe adicional"
            />
          </label>
        </div>
        {erro && <p className="mt-2 text-sm text-rose-300">{erro}</p>}
        <div className="mt-4">
          <button type="button" className="btn-primary" onClick={adicionar} disabled={!podeRegistrar}>
            <Plus className="h-4 w-4" />
            Registrar como informada
          </button>
        </div>
      </section>

      <section className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-100">
          Informadas ({informadas.length}) — origem: {ORIGEM_DADO_LABEL.informado_agente}
        </h3>
        {informadas.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="h-5 w-5" />}
            title="Nenhuma evidência informada"
            description="Registre evidências de repositórios, commits, testes, relatórios, capturas e bloqueios."
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {informadas.map((ev) => (
              <Cartao key={ev.id} ev={ev} />
            ))}
          </ul>
        )}
      </section>

      <section className="glass p-5">
        <h3 className="text-sm font-semibold text-slate-100">
          Verificadas independentemente ({verificadas.length})
        </h3>
        {verificadas.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-5 w-5" />}
            title="Nenhuma evidência verificada"
            description="Evidências só aparecem aqui após verificação por um responsável identificado."
          />
        ) : (
          <ul className="mt-3 space-y-2">
            {verificadas.map((ev) => (
              <Cartao key={ev.id} ev={ev} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
