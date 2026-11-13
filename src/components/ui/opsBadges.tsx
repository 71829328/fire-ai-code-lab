import { EVIDENCE_KIND_LABEL, ORIGEM_DADO_LABEL, type EvidenceKind, type OrigemDado } from "../../platform/types";
import { RUN_STATUS_LABEL, type RunStatus } from "../../orchestration/types";
import { ADAPTER_STATUS_LABEL, type AdapterStatus } from "../../adapters/types";
import { PAPEL_LABEL, type Papel } from "../../platform/types";

const runStyles: Record<RunStatus, string> = {
  enfileirada: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  aguardando_dependencia: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  aguardando_aprovacao: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  executando: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  concluida: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  falhou: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  cancelada: "border-slate-500/30 bg-slate-500/10 text-slate-400",
  expirada: "border-orange-400/40 bg-orange-400/10 text-orange-200",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <span className={`chip ${runStyles[status]}`}>{RUN_STATUS_LABEL[status]}</span>;
}

const origemStyles: Record<OrigemDado, string> = {
  informado_agente: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  informado_operador: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  verificado_independente: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
};

export function OrigemDadoBadge({ origem }: { origem: OrigemDado }) {
  return (
    <span
      className={`chip ${origemStyles[origem]}`}
      title={
        origem === "verificado_independente"
          ? "Comprovado por um verificador identificado."
          : "Informado por um agente/operador — ainda não verificado independentemente."
      }
    >
      {origem === "verificado_independente" ? "Verificada" : "Informada"}
    </span>
  );
}

export function EvidenceKindBadge({ tipo }: { tipo: EvidenceKind }) {
  return (
    <span className="chip border-white/10 bg-white/5 text-slate-300">
      {EVIDENCE_KIND_LABEL[tipo]}
    </span>
  );
}

const adapterStyles: Record<AdapterStatus, string> = {
  disponivel: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  nao_autorizado: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  indisponivel: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  manual_assistido: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
};

export function AdapterStatusBadge({ status }: { status: AdapterStatus }) {
  return <span className={`chip ${adapterStyles[status]}`}>{ADAPTER_STATUS_LABEL[status]}</span>;
}

export function PapelBadge({ papel }: { papel: Papel }) {
  return (
    <span className="chip border-fire/40 bg-fire/10 text-fire-soft">{PAPEL_LABEL[papel]}</span>
  );
}

export { ORIGEM_DADO_LABEL };
