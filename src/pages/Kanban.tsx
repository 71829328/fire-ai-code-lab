import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, GripVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { OrigemBadge, PriorityBadge } from "../components/ui/badges";
import {
  proximaOrdem,
  statusAnterior,
  statusProximo,
  tarefasDaColuna,
} from "../domain/ordering";
import {
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  type Priority,
  type Task,
  type TaskStatus,
} from "../types";

type FormState = Omit<Task, "id" | "criadoEm" | "origem">;

const emptyForm: FormState = {
  titulo: "",
  descricao: "",
  status: "pendente",
  prioridade: "media",
  projetoId: null,
  agenteId: null,
  ordem: 0,
};

const COLUNAS: { status: TaskStatus; accent: string; ring: string }[] = [
  { status: "pendente", accent: "text-fire-soft", ring: "border-fire/40" },
  { status: "em_execucao", accent: "text-cyan-300", ring: "border-cyan-400/40" },
  { status: "concluida", accent: "text-violet-300", ring: "border-violet-400/40" },
];

export function Kanban() {
  const { state, dispatch } = useStore();
  const [busca, setBusca] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("todos");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Task | null>(null);
  const [excluindo, setExcluindo] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erro, setErro] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobreColuna, setSobreColuna] = useState<TaskStatus | null>(null);

  const nomeProjeto = (id: string | null) =>
    state.projetos.find((projeto) => projeto.id === id)?.nome ?? "Sem projeto";
  const nomeAgente = (id: string | null) =>
    state.agentes.find((agente) => agente.id === id)?.nome ?? "Não atribuída";

  // A ordem é SEMPRE calculada sobre todas as tarefas da coluna (não sobre a
  // lista filtrada). O filtro é aplicado apenas depois, para exibição.
  const filtroAtivo = busca.trim() !== "" || filtroProjeto !== "todos";
  const combina = (tarefa: Task): boolean => {
    const termo = busca.trim().toLowerCase();
    const combinaBusca =
      termo === "" ||
      tarefa.titulo.toLowerCase().includes(termo) ||
      tarefa.descricao.toLowerCase().includes(termo);
    const combinaProjeto = filtroProjeto === "todos" || tarefa.projetoId === filtroProjeto;
    return combinaBusca && combinaProjeto;
  };

  const colunas = useMemo(
    () =>
      COLUNAS.map((coluna) => ({
        ...coluna,
        tarefas: tarefasDaColuna(state.tarefas, coluna.status).filter(combina),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.tarefas, busca, filtroProjeto]
  );

  const abrirCriacao = () => {
    setForm(emptyForm);
    setErro("");
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (tarefa: Task) => {
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao,
      status: tarefa.status,
      prioridade: tarefa.prioridade,
      projetoId: tarefa.projetoId,
      agenteId: tarefa.agenteId,
      ordem: tarefa.ordem,
    });
    setErro("");
    setCriando(false);
    setEditando(tarefa);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
    setErro("");
  };

  const salvar = () => {
    if (!form.titulo.trim()) {
      setErro("Informe o título da tarefa.");
      return;
    }
    const base = { ...form, titulo: form.titulo.trim() };
    if (editando) {
      dispatch({ type: "tarefa/atualizar", payload: { ...editando, ...base } });
    } else {
      dispatch({
        type: "tarefa/criar",
        payload: { ...base, origem: "cadastrado", ordem: proximaOrdem(state.tarefas, base.status) },
      });
    }
    fechar();
  };

  const mover = (id: string, destino: TaskStatus) => {
    dispatch({ type: "tarefa/mover", payload: { id, status: destino } });
  };

  const soltar = (destino: TaskStatus) => {
    if (arrastando) mover(arrastando, destino);
    setArrastando(null);
    setSobreColuna(null);
  };

  const onKeyDown = (event: React.KeyboardEvent, tarefa: Task) => {
    if (event.key === "ArrowLeft") {
      const destino = statusAnterior(tarefa.status);
      if (destino) {
        event.preventDefault();
        mover(tarefa.id, destino);
      }
    } else if (event.key === "ArrowRight") {
      const destino = statusProximo(tarefa.status);
      if (destino) {
        event.preventDefault();
        mover(tarefa.id, destino);
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="field pl-9"
            placeholder="Buscar tarefas..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar tarefas"
          />
        </div>
        <select
          className="field sm:w-56"
          value={filtroProjeto}
          onChange={(event) => setFiltroProjeto(event.target.value)}
          aria-label="Filtrar por projeto"
        >
          <option value="todos">Todos os projetos</option>
          {state.projetos.map((projeto) => (
            <option key={projeto.id} value={projeto.id}>
              {projeto.nome}
            </option>
          ))}
        </select>
        <button type="button" className="btn-primary" onClick={abrirCriacao}>
          <Plus className="h-4 w-4" />
          Nova tarefa
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Arraste os cartões entre as colunas, use os botões ← / → ou as setas do teclado com o
        cartão focado.{" "}
        {filtroAtivo
          ? "A ordem das colunas é calculada sobre todas as tarefas, mesmo com filtros ativos."
          : "As alterações são salvas automaticamente no navegador."}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {colunas.map((coluna) => {
          const anterior = statusAnterior(coluna.status);
          const proximo = statusProximo(coluna.status);
          const destacado = sobreColuna === coluna.status;
          return (
            <section
              key={coluna.status}
              data-coluna={coluna.status}
              onDragOver={(event) => {
                event.preventDefault();
                setSobreColuna(coluna.status);
              }}
              onDragLeave={() => setSobreColuna((atual) => (atual === coluna.status ? null : atual))}
              onDrop={() => soltar(coluna.status)}
              className={[
                "glass flex flex-col p-4 transition-all duration-200",
                destacado ? `${coluna.ring} shadow-glow` : "",
              ].join(" ")}
              aria-label={`Coluna ${TASK_STATUS_LABEL[coluna.status]}`}
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className={`text-sm font-semibold ${coluna.accent}`}>
                  {TASK_STATUS_LABEL[coluna.status]}
                </h2>
                <span className="chip border-white/10 bg-white/5 text-slate-300">
                  {coluna.tarefas.length}
                </span>
              </header>

              <div className="flex flex-1 flex-col gap-3">
                {coluna.tarefas.length === 0 && (
                  <p className="glass-soft px-3 py-6 text-center text-xs text-slate-500">
                    {filtroAtivo ? "Nenhuma tarefa corresponde ao filtro." : "Solte um cartão aqui."}
                  </p>
                )}
                {coluna.tarefas.map((tarefa) => (
                  <article
                    key={tarefa.id}
                    draggable
                    tabIndex={0}
                    role="group"
                    data-task-card={tarefa.id}
                    aria-label={`Tarefa ${tarefa.titulo}`}
                    onDragStart={() => setArrastando(tarefa.id)}
                    onDragEnd={() => {
                      setArrastando(null);
                      setSobreColuna(null);
                    }}
                    onKeyDown={(event) => onKeyDown(event, tarefa)}
                    className={[
                      "glass-soft group cursor-grab p-3.5 transition-all duration-200 hover:border-fire/40 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-fire/50 active:cursor-grabbing",
                      arrastando === tarefa.id ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                        <h3 className="text-sm font-semibold text-slate-100">{tarefa.titulo}</h3>
                      </div>
                      <OrigemBadge origem={tarefa.origem} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 pl-6 text-xs text-slate-400">
                      {tarefa.descricao}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-6">
                      <PriorityBadge prioridade={tarefa.prioridade} />
                    </div>
                    <div className="mt-2.5 space-y-0.5 pl-6 text-[11px] text-slate-500">
                      <p>Projeto: {nomeProjeto(tarefa.projetoId)}</p>
                      <p>Agente: {nomeAgente(tarefa.agenteId)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 pl-6">
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        disabled={!anterior}
                        onClick={() => anterior && mover(tarefa.id, anterior)}
                        aria-label={`Mover ${tarefa.titulo} para ${anterior ? TASK_STATUS_LABEL[anterior] : "nenhuma coluna"}`}
                        title={anterior ? `Mover para ${TASK_STATUS_LABEL[anterior]}` : "Já está na primeira coluna"}
                      >
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        disabled={!proximo}
                        onClick={() => proximo && mover(tarefa.id, proximo)}
                        aria-label={`Mover ${tarefa.titulo} para ${proximo ? TASK_STATUS_LABEL[proximo] : "nenhuma coluna"}`}
                        title={proximo ? `Mover para ${TASK_STATUS_LABEL[proximo]}` : "Já está na última coluna"}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost !px-2.5 !py-1.5 text-xs"
                        onClick={() => abrirEdicao(tarefa)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger !px-2.5 !py-1.5 text-xs"
                        onClick={() => setExcluindo(tarefa)}
                        aria-label={`Excluir ${tarefa.titulo}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Modal
        open={criando || editando !== null}
        title={editando ? "Editar tarefa" : "Nova tarefa"}
        description="Vincule a tarefa a um projeto e a um agente do painel."
        onClose={fechar}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={fechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar}>
              {editando ? "Salvar alterações" : "Cadastrar tarefa"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="tarefa-titulo">
              Título
            </label>
            <input
              id="tarefa-titulo"
              className="field"
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="tarefa-descricao">
              Descrição
            </label>
            <textarea
              id="tarefa-descricao"
              className="field min-h-[72px]"
              value={form.descricao}
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="tarefa-status">
              Status
            </label>
            <select
              id="tarefa-status"
              className="field"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as TaskStatus })}
            >
              {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tarefa-prioridade">
              Prioridade
            </label>
            <select
              id="tarefa-prioridade"
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
            <label className="label" htmlFor="tarefa-projeto">
              Projeto
            </label>
            <select
              id="tarefa-projeto"
              className="field"
              value={form.projetoId ?? ""}
              onChange={(event) => setForm({ ...form, projetoId: event.target.value || null })}
            >
              <option value="">Sem projeto</option>
              {state.projetos.map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tarefa-agente">
              Agente
            </label>
            <select
              id="tarefa-agente"
              className="field"
              value={form.agenteId ?? ""}
              onChange={(event) => setForm({ ...form, agenteId: event.target.value || null })}
            >
              <option value="">Não atribuída</option>
              {state.agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}
      </Modal>

      <ConfirmDialog
        open={excluindo !== null}
        title="Excluir tarefa"
        description={
          excluindo
            ? `A tarefa “${excluindo.titulo}” será removida permanentemente do quadro. Deseja continuar?`
            : ""
        }
        confirmLabel="Excluir tarefa"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => {
          if (excluindo) dispatch({ type: "tarefa/remover", payload: { id: excluindo.id } });
          setExcluindo(null);
        }}
      />
    </div>
  );
}
