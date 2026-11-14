import { PageIdentity } from "../components/ui/PageIdentity";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileUp,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Target,
  Trash2,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CopyButton } from "../components/ui/CopyButton";
import { EmptyState } from "../components/ui/EmptyState";
import {
  EvidenceTypeBadge,
  MissionStatusBadge,
  OrigemBadge,
  PriorityBadge,
} from "../components/ui/badges";
import { buildMissionPrompt } from "../domain/missionPrompt";
import {
  MISSION_STATUS_LABEL,
  PRIORITY_LABEL,
  type EvidenceType,
  type Mission,
  type MissionStatus,
  type Priority,
} from "../types";

interface MissionForm {
  titulo: string;
  objetivo: string;
  instrucoes: string;
  prioridade: Priority;
  criteriosAceite: string; // um critério por linha
  agenteId: string | null;
  projetoId: string | null;
  dependencias: string[];
  status: MissionStatus;
}

const emptyForm: MissionForm = {
  titulo: "",
  objetivo: "",
  instrucoes: "",
  prioridade: "media",
  criteriosAceite: "",
  agenteId: null,
  projetoId: null,
  dependencias: [],
  status: "pendente",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const EVIDENCE_TYPES: EvidenceType[] = ["evidencia", "commit", "resultado", "relatorio"];

// Fila operacional: prioridade (alta → baixa) e, em empate, atualização mais recente.
const ORDEM_PRIORIDADE: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };

export function Missions() {
  const { state, dispatch } = useStore();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<MissionStatus | "todos">("todos");
  const [filtroAgente, setFiltroAgente] = useState("todos");

  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Mission | null>(null);
  const [detalhe, setDetalhe] = useState<Mission | null>(null);
  const [excluindo, setExcluindo] = useState<Mission | null>(null);
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [erro, setErro] = useState("");

  const nomeAgente = (id: string | null) =>
    state.agentes.find((a) => a.id === id)?.nome ?? "Não atribuído";
  const nomeProjeto = (id: string | null) =>
    state.projetos.find((p) => p.id === id)?.nome ?? "Não vinculado";

  const missoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return state.missoes
      .filter((missao) => {
        const combinaBusca =
          termo === "" ||
          missao.codigo.toLowerCase().includes(termo) ||
          missao.titulo.toLowerCase().includes(termo) ||
          missao.objetivo.toLowerCase().includes(termo);
        const combinaStatus = filtroStatus === "todos" || missao.status === filtroStatus;
        const combinaAgente =
          filtroAgente === "todos" || (missao.agenteId ?? "sem") === filtroAgente;
        return combinaBusca && combinaStatus && combinaAgente;
      })
      .sort(
        (a, b) =>
          ORDEM_PRIORIDADE[a.prioridade] - ORDEM_PRIORIDADE[b.prioridade] ||
          b.atualizadoEm.localeCompare(a.atualizadoEm)
      );
  }, [state.missoes, busca, filtroStatus, filtroAgente]);

  const abrirCriacao = () => {
    setForm(emptyForm);
    setErro("");
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (missao: Mission) => {
    setForm({
      titulo: missao.titulo,
      objetivo: missao.objetivo,
      instrucoes: missao.instrucoes,
      prioridade: missao.prioridade,
      criteriosAceite: missao.criteriosAceite.join("\n"),
      agenteId: missao.agenteId,
      projetoId: missao.projetoId,
      dependencias: missao.dependencias,
      status: missao.status,
    });
    setErro("");
    setCriando(false);
    setEditando(missao);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
    setErro("");
  };

  const salvar = () => {
    if (!form.titulo.trim()) {
      setErro("Informe o título da missão.");
      return;
    }
    const criterios = form.criteriosAceite
      .split("\n")
      .map((linha) => linha.trim())
      .filter(Boolean);
    const base = {
      titulo: form.titulo.trim(),
      objetivo: form.objetivo.trim(),
      instrucoes: form.instrucoes.trim(),
      prioridade: form.prioridade,
      criteriosAceite: criterios,
      agenteId: form.agenteId,
      projetoId: form.projetoId,
      dependencias: form.dependencias,
      status: form.status,
    };
    if (editando) {
      dispatch({ type: "missao/atualizar", payload: { ...editando, ...base } });
    } else {
      dispatch({
        type: "missao/criar",
        payload: { ...base, origem: "cadastrado" },
      });
    }
    fechar();
  };

  const alternarDependencia = (id: string) => {
    setForm((atual) => ({
      ...atual,
      dependencias: atual.dependencias.includes(id)
        ? atual.dependencias.filter((dep) => dep !== id)
        : [...atual.dependencias, id],
    }));
  };

  return (
    <div className="fire-page fire-page--missoes space-y-5">
      <PageIdentity page="missoes" />
      <section
        className="fire-queue grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        aria-label="Fila de missões por situação"
      >
        {(Object.keys(MISSION_STATUS_LABEL) as MissionStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filtroStatus === status}
            onClick={() => setFiltroStatus(filtroStatus === status ? "todos" : status)}
            className="fire-queue-item"
          >
            <span className="fire-queue-label">{MISSION_STATUS_LABEL[status]}</span>
            <strong className="fire-queue-value">
              {state.missoes.filter((m) => m.status === status).length}
            </strong>
          </button>
        ))}
      </section>
      <div className="fire-toolbar">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="field pl-9"
            placeholder="Buscar por código, título ou objetivo..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar missões"
          />
        </div>
        <select
          className="field lg:w-52"
          value={filtroStatus}
          onChange={(event) => setFiltroStatus(event.target.value as MissionStatus | "todos")}
          aria-label="Filtrar por status"
        >
          <option value="todos">Todos os status</option>
          {(Object.keys(MISSION_STATUS_LABEL) as MissionStatus[]).map((status) => (
            <option key={status} value={status}>
              {MISSION_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          className="field lg:w-52"
          value={filtroAgente}
          onChange={(event) => setFiltroAgente(event.target.value)}
          aria-label="Filtrar por agente"
        >
          <option value="todos">Todos os agentes</option>
          <option value="sem">Sem agente</option>
          {state.agentes.map((agente) => (
            <option key={agente.id} value={agente.id}>
              {agente.nome}
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={abrirCriacao}>
          <Plus className="h-4 w-4" />
          Nova missão
        </button>
      </div>

      {missoesFiltradas.length === 0 ? (
        <EmptyState
          icon={<Target className="h-5 w-5" />}
          title="Nenhuma missão encontrada"
          description="Ajuste a busca/filtros ou cadastre uma nova missão com objetivo, instruções e critérios de aceite."
          action={
            <button type="button" className="btn-primary" onClick={abrirCriacao}>
              <Plus className="h-4 w-4" />
              Nova missão
            </button>
          }
        />
      ) : (
        <div className="glass fire-table-wrap">
          <table className="fire-table">
            <caption className="sr-only">Fila operacional de missões, ordenada por prioridade</caption>
            <thead>
              <tr>
                <th scope="col">Missão</th>
                <th scope="col">Situação</th>
                <th scope="col">Prioridade</th>
                <th scope="col" className="hidden lg:table-cell">Responsável</th>
                <th scope="col" className="hidden xl:table-cell">Projeto</th>
                <th scope="col" className="hidden text-center xl:table-cell">Crit.</th>
                <th scope="col" className="hidden text-center xl:table-cell">Evid.</th>
                <th scope="col" className="hidden whitespace-nowrap lg:table-cell">Atualizada</th>
                <th scope="col" className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {missoesFiltradas.map((missao) => (
                <tr key={missao.id}>
                  <td className="min-w-[220px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[11px] font-semibold text-fire-soft">
                        {missao.codigo}
                      </span>
                      <span className="text-sm font-medium text-slate-100">{missao.titulo}</span>
                      <span className="line-clamp-1 text-xs text-slate-500">
                        {missao.objetivo || "Sem objetivo informado."}
                      </span>
                    </div>
                  </td>
                  <td>
                    <MissionStatusBadge status={missao.status} />
                  </td>
                  <td>
                    <PriorityBadge prioridade={missao.prioridade} />
                  </td>
                  <td className="hidden text-sm text-slate-300 lg:table-cell">
                    {nomeAgente(missao.agenteId)}
                  </td>
                  <td className="hidden text-sm text-slate-300 xl:table-cell">
                    {nomeProjeto(missao.projetoId)}
                  </td>
                  <td className="hidden text-center text-sm tabular-nums text-slate-300 xl:table-cell">
                    {missao.criteriosAceite.length}
                  </td>
                  <td className="hidden text-center text-sm tabular-nums text-slate-300 xl:table-cell">
                    {missao.evidencias.length}
                  </td>
                  <td className="hidden whitespace-nowrap text-xs text-slate-500 lg:table-cell">
                    {dateFormatter.format(new Date(missao.atualizadoEm))}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        onClick={() => setDetalhe(missao)}
                        title="Abrir detalhes da missão"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Detalhes</span>
                      </button>
                      <CopyButton
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        texto={buildMissionPrompt(missao, {
                          agenteNome: nomeAgente(missao.agenteId),
                          projetoNome: nomeProjeto(missao.projetoId),
                          dependencias: missao.dependencias
                            .map((dep) => state.missoes.find((m) => m.id === dep))
                            .filter((dep): dep is Mission => Boolean(dep))
                            .map((dep) => ({
                              codigo: dep.codigo,
                              titulo: dep.titulo,
                              status: dep.status,
                            })),
                        })}
                        label="Copiar prompt"
                      />
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        onClick={() => abrirEdicao(missao)}
                        aria-label={`Editar ${missao.codigo}`}
                        title="Editar missão"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn-danger !px-2.5 !py-1.5 text-xs"
                        onClick={() => setExcluindo(missao)}
                        aria-label={`Excluir ${missao.codigo}`}
                        title="Excluir missão"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Criar / editar */}
      <Modal
        open={criando || editando !== null}
        title={editando ? `Editar missão ${editando.codigo}` : "Nova missão"}
        description="A missão recebe um identificador único automaticamente ao ser salva."
        onClose={fechar}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={fechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar}>
              {editando ? "Salvar alterações" : "Cadastrar missão"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="missao-titulo">
              Título
            </label>
            <input
              id="missao-titulo"
              className="field"
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="missao-objetivo">
              Objetivo
            </label>
            <textarea
              id="missao-objetivo"
              className="field min-h-[64px]"
              value={form.objetivo}
              onChange={(event) => setForm({ ...form, objetivo: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="missao-instrucoes">
              Instruções
            </label>
            <textarea
              id="missao-instrucoes"
              className="field min-h-[84px]"
              value={form.instrucoes}
              onChange={(event) => setForm({ ...form, instrucoes: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="missao-criterios">
              Critérios de aceite (um por linha)
            </label>
            <textarea
              id="missao-criterios"
              className="field min-h-[72px]"
              value={form.criteriosAceite}
              onChange={(event) => setForm({ ...form, criteriosAceite: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="missao-prioridade">
              Prioridade
            </label>
            <select
              id="missao-prioridade"
              className="field"
              value={form.prioridade}
              onChange={(event) =>
                setForm({ ...form, prioridade: event.target.value as Priority })
              }
            >
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((prioridade) => (
                <option key={prioridade} value={prioridade}>
                  {PRIORITY_LABEL[prioridade]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="missao-status">
              Status
            </label>
            <select
              id="missao-status"
              className="field"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as MissionStatus })
              }
            >
              {(Object.keys(MISSION_STATUS_LABEL) as MissionStatus[]).map((status) => (
                <option key={status} value={status}>
                  {MISSION_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="missao-agente">
              Agente responsável
            </label>
            <select
              id="missao-agente"
              className="field"
              value={form.agenteId ?? ""}
              onChange={(event) => setForm({ ...form, agenteId: event.target.value || null })}
            >
              <option value="">Não atribuído</option>
              {state.agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="missao-projeto">
              Projeto
            </label>
            <select
              id="missao-projeto"
              className="field"
              value={form.projetoId ?? ""}
              onChange={(event) => setForm({ ...form, projetoId: event.target.value || null })}
            >
              <option value="">Não vinculado</option>
              {state.projetos.map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <span className="label">Dependências</span>
            <div className="glass-soft max-h-40 space-y-1 overflow-y-auto p-2">
              {state.missoes
                .filter((outra) => outra.id !== editando?.id)
                .map((outra) => (
                  <label
                    key={outra.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-300 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#ff7a1a]"
                      checked={form.dependencias.includes(outra.id)}
                      onChange={() => alternarDependencia(outra.id)}
                    />
                    <span className="font-mono text-xs text-fire-soft">{outra.codigo}</span>
                    <span className="truncate">{outra.titulo}</span>
                  </label>
                ))}
              {state.missoes.length <= (editando ? 1 : 0) && (
                <p className="px-2 py-1 text-xs text-slate-500">
                  Nenhuma outra missão disponível para dependência.
                </p>
              )}
            </div>
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}
      </Modal>

      {/* Detalhes + evidências + importação de relatório */}
      {detalhe && (
        <MissionDetail
          missao={state.missoes.find((m) => m.id === detalhe.id) ?? detalhe}
          onClose={() => setDetalhe(null)}
        />
      )}

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir missão"
        description={
          excluindo
            ? `A missão ${excluindo.codigo} — “${excluindo.titulo}”, seu histórico e suas evidências serão removidos. Referências de dependência serão limpas. Recomenda-se exportar um backup em Dados & Backup antes. Deseja continuar?`
            : ""
        }
        confirmLabel="Excluir missão"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => {
          if (excluindo) dispatch({ type: "missao/remover", payload: { id: excluindo.id } });
          setExcluindo(null);
        }}
      />
    </div>
  );
}

function MissionDetail({ missao, onClose }: { missao: Mission; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [tipo, setTipo] = useState<EvidenceType>("relatorio");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");

  const agenteNome = state.agentes.find((a) => a.id === missao.agenteId)?.nome ?? "Não atribuído";
  const projetoNome = state.projetos.find((p) => p.id === missao.projetoId)?.nome ?? "Não vinculado";

  const adicionarEvidencia = (autor: "usuario" | "importado") => {
    if (!descricao.trim()) return;
    dispatch({
      type: "missao/evidencia/adicionar",
      payload: {
        id: missao.id,
        evidencia: { tipo, descricao: descricao.trim(), valor: valor.trim(), autor },
      },
    });
    setDescricao("");
    setValor("");
  };

  const prompt = buildMissionPrompt(missao, {
    agenteNome,
    projetoNome,
    dependencias: missao.dependencias
      .map((dep) => state.missoes.find((m) => m.id === dep))
      .filter((dep): dep is Mission => Boolean(dep))
      .map((dep) => ({ codigo: dep.codigo, titulo: dep.titulo, status: dep.status })),
  });

  return (
    <Modal
      open
      title={`${missao.codigo} — ${missao.titulo}`}
      description={`Agente: ${agenteNome} · Projeto: ${projetoNome}`}
      onClose={onClose}
      footer={
        <>
          <CopyButton className="btn-ghost" texto={prompt} label="Copiar prompt completo" />
          <button type="button" className="btn-primary" onClick={onClose}>
            Fechar
          </button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center gap-2">
          <MissionStatusBadge status={missao.status} />
          <PriorityBadge prioridade={missao.prioridade} />
          <OrigemBadge origem={missao.origem} />
        </div>

        {/* Alterar status (execução manual e demais transições) */}
        <section>
          <h3 className="label">Status de execução</h3>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(MISSION_STATUS_LABEL) as MissionStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                disabled={status === missao.status}
                className="btn-ghost !px-3 !py-1.5 text-xs disabled:opacity-100 disabled:border-fire/40 disabled:bg-fire/10 disabled:text-fire-soft"
                onClick={() =>
                  dispatch({
                    type: "missao/status",
                    payload: { id: missao.id, status, descricao: "Alterado manualmente na central" },
                  })
                }
              >
                {MISSION_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="label">Objetivo</h3>
          <p className="text-sm text-slate-300">{missao.objetivo || "Não informado."}</p>
        </section>

        <section>
          <h3 className="label">Instruções</h3>
          <p className="whitespace-pre-line text-sm text-slate-300">
            {missao.instrucoes || "Não informadas."}
          </p>
        </section>

        <section>
          <h3 className="label">Critérios de aceite</h3>
          {missao.criteriosAceite.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum critério informado.</p>
          ) : (
            <ul className="space-y-1.5">
              {missao.criteriosAceite.map((criterio, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                  {criterio}
                </li>
              ))}
            </ul>
          )}
        </section>

        {missao.dependencias.length > 0 && (
          <section>
            <h3 className="label">Dependências</h3>
            <ul className="space-y-1">
              {missao.dependencias.map((depId) => {
                const dep = state.missoes.find((m) => m.id === depId);
                return (
                  <li key={depId} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="font-mono text-xs text-fire-soft">
                      {dep?.codigo ?? "removida"}
                    </span>
                    <span className="truncate">{dep?.titulo ?? "(missão não encontrada)"}</span>
                    {dep && <MissionStatusBadge status={dep.status} />}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h3 className="label">Registrar evidência / commit / resultado / relatório</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className="field"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as EvidenceType)}
              aria-label="Tipo de evidência"
            >
              {EVIDENCE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              className="field sm:col-span-2"
              placeholder="Descrição (ex.: commit abc123)"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
            />
            <textarea
              className="field min-h-[56px] sm:col-span-3"
              placeholder="Valor / referência / conteúdo do relatório importado"
              value={valor}
              onChange={(event) => setValor(event.target.value)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ghost !px-3 text-xs"
              onClick={() => adicionarEvidencia("usuario")}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar evidência
            </button>
            <button
              type="button"
              className="btn-ghost !px-3 text-xs"
              onClick={() => adicionarEvidencia("importado")}
              title="Marca a evidência como relatório externo importado manualmente"
            >
              <FileUp className="h-3.5 w-3.5" />
              Importar relatório de execução
            </button>
          </div>
        </section>

        <section>
          <h3 className="label">Evidências registradas</h3>
          {missao.evidencias.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhuma evidência registrada.</p>
          ) : (
            <ul className="space-y-2">
              {missao.evidencias.map((ev) => (
                <li key={ev.id} className="glass-soft flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <EvidenceTypeBadge tipo={ev.tipo} />
                      <span className="text-[11px] text-slate-500">
                        {ev.autor} · {dateFormatter.format(new Date(ev.timestamp))}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-200">{ev.descricao}</p>
                    {ev.valor && (
                      <p className="mt-0.5 break-words text-xs text-slate-400">{ev.valor}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-danger !px-2 !py-1 text-xs"
                    onClick={() =>
                      dispatch({
                        type: "missao/evidencia/remover",
                        payload: { id: missao.id, evidenciaId: ev.id },
                      })
                    }
                    aria-label="Remover evidência"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="label">Histórico de execução</h3>
          {missao.historico.length === 0 ? (
            <p className="text-sm text-slate-400">Sem histórico.</p>
          ) : (
            <ol className="relative space-y-3 border-l border-white/10 pl-5">
              {[...missao.historico].reverse().map((entrada) => (
                <li key={entrada.id} className="relative">
                  <span
                    className="absolute -left-[26px] mt-1 flex h-3 w-3 rounded-full border border-fire/50 bg-fire/30"
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <MissionStatusBadge status={entrada.status} />
                    <span className="text-[11px] text-slate-500">
                      {dateFormatter.format(new Date(entrada.timestamp))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{entrada.descricao}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          Execução manual/assistida. Nenhuma integração automática está ativa: registre resultados e
          anexe evidências manualmente.
        </p>
      </div>
    </Modal>
  );
}
