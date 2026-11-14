import { PageIdentity } from "../components/ui/PageIdentity";
import { useState } from "react";
import {
  Ban,
  Bot,
  CheckCircle2,
  FolderKanban,
  History as HistoryIcon,
  Link2,
  Plus,
  Wrench,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { missoesParaAprovacao } from "../store/selectors";
import { EmptyState } from "../components/ui/EmptyState";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CopyButton } from "../components/ui/CopyButton";
import {
  EvidenceTypeBadge,
  MissionStatusBadge,
  PriorityBadge,
} from "../components/ui/badges";
import { buildMissionPrompt } from "../domain/missionPrompt";
import {
  EVIDENCE_TYPE_LABEL,
  MISSION_STATUS_LABEL,
  type EvidenceAuthor,
  type EvidenceType,
  type Mission,
  type MissionEvidence,
  type MissionStatus,
} from "../types";

type Decisao = "aprovar" | "ajustes" | "bloquear";

interface DecisaoConfig {
  label: string;
  status: MissionStatus;
  descricao: string;
  tone: "primary" | "danger";
  confirmTitle: string;
  confirmDescription: string;
  icon: typeof CheckCircle2;
}

// Ações de decisão da revisão técnica, cada uma com o status destino e o texto
// registrado no histórico da missão.
const DECISOES: Record<Decisao, DecisaoConfig> = {
  aprovar: {
    label: "Aprovar",
    status: "concluida",
    descricao: "Aprovada na revisão técnica",
    tone: "primary",
    confirmTitle: "Aprovar missão",
    confirmDescription:
      "A missão será marcada como concluída. Confirme que os critérios de aceite foram atendidos.",
    icon: CheckCircle2,
  },
  ajustes: {
    label: "Solicitar ajustes",
    status: "execucao_manual",
    descricao: "Ajustes solicitados na revisão técnica",
    tone: "primary",
    confirmTitle: "Solicitar ajustes",
    confirmDescription: "A missão volta para execução manual para receber as correções.",
    icon: Wrench,
  },
  bloquear: {
    label: "Bloquear",
    status: "bloqueada",
    descricao: "Bloqueada na revisão técnica",
    tone: "danger",
    confirmTitle: "Bloquear missão",
    confirmDescription: "A missão ficará bloqueada e sairá da fila de aprovação.",
    icon: Ban,
  },
};

const autorLabel: Record<EvidenceAuthor, string> = {
  usuario: "Usuário",
  executor_local: "Executor local",
  importado: "Importado",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Formulário inline de evidência de revisão. Mantém estado próprio por missão,
// evitando desmontar o restante da lista a cada digitação.
function EvidenciaForm({
  missaoId,
  onAdicionar,
}: {
  missaoId: string;
  onAdicionar: (
    missaoId: string,
    evidencia: Omit<MissionEvidence, "id" | "timestamp">
  ) => void;
}) {
  const [tipo, setTipo] = useState<EvidenceType>("evidencia");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState("");

  const enviar = () => {
    if (!descricao.trim()) {
      setErro("Informe a descrição da evidência.");
      return;
    }
    onAdicionar(missaoId, {
      tipo,
      descricao: descricao.trim(),
      valor: valor.trim(),
      autor: "usuario",
    });
    setTipo("evidencia");
    setDescricao("");
    setValor("");
    setErro("");
  };

  return (
    <div className="fire-page fire-page--aprovacoes glass-soft space-y-3 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`ev-tipo-${missaoId}`}>
            Tipo
          </label>
          <select
            id={`ev-tipo-${missaoId}`}
            className="field"
            value={tipo}
            onChange={(event) => setTipo(event.target.value as EvidenceType)}
          >
            {(Object.keys(EVIDENCE_TYPE_LABEL) as EvidenceType[]).map((chave) => (
              <option key={chave} value={chave}>
                {EVIDENCE_TYPE_LABEL[chave]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor={`ev-descricao-${missaoId}`}>
            Descrição
          </label>
          <input
            id={`ev-descricao-${missaoId}`}
            className="field"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            placeholder="Ex.: Revisão do critério 1 conferida"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor={`ev-valor-${missaoId}`}>
            Valor (opcional)
          </label>
          <input
            id={`ev-valor-${missaoId}`}
            className="field"
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            placeholder="Link, hash, referência..."
          />
        </div>
      </div>
      {erro && <p className="text-sm text-rose-300">{erro}</p>}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" onClick={enviar}>
          <Plus className="h-4 w-4" />
          Adicionar evidência
        </button>
      </div>
    </div>
  );
}

export function Approvals() {
  const { state, dispatch } = useStore();
  const pendentes = missoesParaAprovacao(state);
  const [confirmacao, setConfirmacao] = useState<{ missaoId: string; decisao: Decisao } | null>(
    null
  );

  const mapaMissoes = new Map(state.missoes.map((missao) => [missao.id, missao]));

  const nomeAgente = (id: string | null) =>
    state.agentes.find((agente) => agente.id === id)?.nome ?? "Não atribuído";
  const nomeProjeto = (id: string | null) =>
    state.projetos.find((projeto) => projeto.id === id)?.nome ?? "Não vinculado";

  const confirmar = () => {
    if (!confirmacao) return;
    const config = DECISOES[confirmacao.decisao];
    dispatch({
      type: "missao/status",
      payload: {
        id: confirmacao.missaoId,
        status: config.status,
        descricao: config.descricao,
      },
    });
    setConfirmacao(null);
  };

  const adicionarEvidencia = (
    missaoId: string,
    evidencia: Omit<MissionEvidence, "id" | "timestamp">
  ) => {
    dispatch({ type: "missao/evidencia/adicionar", payload: { id: missaoId, evidencia } });
  };

  if (pendentes.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-5 w-5" />}
        title="Nenhuma missão aguardando aprovação"
        description="Quando houver missões prontas para revisão técnica, elas aparecerão aqui para decisão."
      />
    );
  }

  return (
    <div className="fire-page fire-page--aprovacoes space-y-5">
      <PageIdentity page="aprovacoes" />
      <div className="glass flex flex-wrap items-center justify-between gap-2 p-4">
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-slate-100">{pendentes.length}</span> missão(ões)
          aguardando revisão técnica.
        </p>
        <p className="text-xs text-slate-500">
          Decisões registram automaticamente uma entrada no histórico da missão.
        </p>
      </div>

      <div className="space-y-5 stagger">
        {pendentes.map((missao: Mission) => {
          const dependencias = missao.dependencias
            .map((depId) => mapaMissoes.get(depId))
            .filter((dep): dep is Mission => dep !== undefined)
            .map((dep) => ({ codigo: dep.codigo, titulo: dep.titulo, status: dep.status }));

          const prompt = buildMissionPrompt(missao, {
            agenteNome: nomeAgente(missao.agenteId),
            projetoNome: nomeProjeto(missao.projetoId),
            dependencias,
          });

          return (
            <article key={missao.id} className="glass p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-fire-soft">
                    {missao.codigo}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-50">{missao.titulo}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MissionStatusBadge status={missao.status} />
                  <PriorityBadge prioridade={missao.prioridade} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Objetivo
                    </h4>
                    <p className="mt-1 text-sm text-slate-300">
                      {missao.objetivo || "Não informado."}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Instruções
                    </h4>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-300">
                      {missao.instrucoes || "Não informadas."}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Critérios de aceite
                    </h4>
                    {missao.criteriosAceite.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {missao.criteriosAceite.map((criterio, indice) => (
                          <li
                            key={`${missao.id}-crit-${indice}`}
                            className="flex items-start gap-2 text-sm text-slate-300"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                            <span>{criterio}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">Nenhum critério informado.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="glass-soft space-y-2 p-3 text-sm text-slate-300">
                    <p className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-cyan-300" />
                      Agente: <span className="text-slate-100">{nomeAgente(missao.agenteId)}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4 text-violet-300" />
                      Projeto:{" "}
                      <span className="text-slate-100">{nomeProjeto(missao.projetoId)}</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link2 className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-400">Dependências:</span>
                      {dependencias.length > 0 ? (
                        dependencias.map((dep) => (
                          <span
                            key={dep.codigo}
                            className="chip border-white/10 bg-white/5 text-slate-300"
                            title={dep.titulo}
                          >
                            {dep.codigo}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500">Nenhuma</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Evidências ({missao.evidencias.length})
                    </h4>
                    {missao.evidencias.length > 0 ? (
                      <ul className="mt-1 space-y-2">
                        {missao.evidencias.map((evidencia) => (
                          <li key={evidencia.id} className="glass-soft p-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <EvidenceTypeBadge tipo={evidencia.tipo} />
                              <span className="chip border-white/10 bg-white/5 text-slate-400">
                                {autorLabel[evidencia.autor]}
                              </span>
                              <span className="ml-auto text-[11px] text-slate-500">
                                {dateFormatter.format(new Date(evidencia.timestamp))}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-200">{evidencia.descricao}</p>
                            {evidencia.valor && (
                              <p className="mt-0.5 break-all text-xs text-slate-400">
                                {evidencia.valor}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">Nenhuma evidência registrada.</p>
                    )}
                  </div>

                  <div>
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <HistoryIcon className="h-3.5 w-3.5" />
                      Histórico
                    </h4>
                    <ol className="mt-2 space-y-2 border-l border-white/10 pl-4">
                      {[...missao.historico].reverse().map((entrada) => (
                        <li key={entrada.id} className="relative">
                          <span
                            className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-fire"
                            aria-hidden
                          />
                          <p className="text-sm text-slate-300">{entrada.descricao}</p>
                          <p className="text-[11px] text-slate-500">
                            {MISSION_STATUS_LABEL[entrada.status]} ·{" "}
                            {dateFormatter.format(new Date(entrada.timestamp))}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {(Object.keys(DECISOES) as Decisao[]).map((decisao) => {
                  const config = DECISOES[decisao];
                  const Icon = config.icon;
                  return (
                    <button
                      key={decisao}
                      type="button"
                      className={config.tone === "danger" ? "btn-danger" : "btn-primary"}
                      onClick={() => setConfirmacao({ missaoId: missao.id, decisao })}
                    >
                      <Icon className="h-4 w-4" />
                      {config.label}
                    </button>
                  );
                })}
                <CopyButton texto={prompt} label="Copiar prompt" />
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Adicionar evidência de revisão
                </h4>
                <EvidenciaForm missaoId={missao.id} onAdicionar={adicionarEvidencia} />
              </div>
            </article>
          );
        })}
      </div>

      <ConfirmDialog
        open={confirmacao !== null}
        title={confirmacao ? DECISOES[confirmacao.decisao].confirmTitle : ""}
        description={confirmacao ? DECISOES[confirmacao.decisao].confirmDescription : ""}
        confirmLabel={confirmacao ? DECISOES[confirmacao.decisao].label : "Confirmar"}
        tone={confirmacao ? DECISOES[confirmacao.decisao].tone : "primary"}
        onConfirm={confirmar}
        onCancel={() => setConfirmacao(null)}
      />
    </div>
  );
}
