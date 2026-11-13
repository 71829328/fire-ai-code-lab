import { useMemo, useState } from "react";
import { CalendarClock, Filter, FolderKanban, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { DemoBadge, PriorityBadge, ProjectStatusBadge } from "../components/ui/badges";
import { ProgressBar } from "../components/charts/Charts";
import { PRIORITY_LABEL, PROJECT_STATUS_LABEL, type Priority, type Project, type ProjectStatus } from "../types";

type FormState = Omit<Project, "id" | "criadoEm" | "demo">;

const emptyForm: FormState = {
  nome: "",
  descricao: "",
  status: "planejado",
  responsavelId: null,
  progresso: 0,
  prioridade: "media",
  prazo: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function Projects() {
  const { state, dispatch } = useStore();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<ProjectStatus | "todos">("todos");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erro, setErro] = useState("");

  const nomeAgente = (id: string | null) =>
    state.agentes.find((agente) => agente.id === id)?.nome ?? "Sem responsável";

  const projetosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return state.projetos.filter((projeto) => {
      const combinaBusca =
        termo === "" ||
        projeto.nome.toLowerCase().includes(termo) ||
        projeto.descricao.toLowerCase().includes(termo);
      const combinaFiltro = filtro === "todos" || projeto.status === filtro;
      return combinaBusca && combinaFiltro;
    });
  }, [state.projetos, busca, filtro]);

  const abrirCriacao = () => {
    setForm(emptyForm);
    setErro("");
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (projeto: Project) => {
    const { id: _id, criadoEm: _criadoEm, demo: _demo, ...rest } = projeto;
    setForm({ ...rest, prazo: rest.prazo.slice(0, 10) });
    setErro("");
    setCriando(false);
    setEditando(projeto);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
    setErro("");
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      setErro("Informe o nome do projeto.");
      return;
    }
    const payload: FormState = {
      ...form,
      nome: form.nome.trim(),
      progresso: Math.max(0, Math.min(100, Number(form.progresso) || 0)),
      prazo: new Date(form.prazo || Date.now()).toISOString(),
    };
    if (editando) {
      dispatch({ type: "projeto/atualizar", payload: { ...editando, ...payload } });
    } else {
      dispatch({ type: "projeto/criar", payload });
    }
    fechar();
  };

  return (
    <div className="space-y-5">
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="field pl-9"
            placeholder="Buscar projetos..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar projetos"
          />
        </div>
        <div className="relative sm:w-52">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            className="field pl-9"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as ProjectStatus | "todos")}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((status) => (
              <option key={status} value={status}>
                {PROJECT_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-primary" onClick={abrirCriacao}>
          <Plus className="h-4 w-4" />
          Novo projeto
        </button>
      </div>

      {projetosFiltrados.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-5 w-5" />}
          title="Nenhum projeto encontrado"
          description="Ajuste a busca ou cadastre um novo projeto demonstrativo."
          action={
            <button type="button" className="btn-primary" onClick={abrirCriacao}>
              <Plus className="h-4 w-4" />
              Novo projeto
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger">
          {projetosFiltrados.map((projeto) => (
            <article key={projeto.id} className="glass glass-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-50">{projeto.nome}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{projeto.descricao}</p>
                </div>
                {projeto.demo && <DemoBadge compact />}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ProjectStatusBadge status={projeto.status} />
                <PriorityBadge prioridade={projeto.prioridade} />
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Progresso</span>
                  <span className="font-semibold text-slate-200">{projeto.progresso}%</span>
                </div>
                <ProgressBar value={projeto.progresso} />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-300" aria-hidden />
                  {nomeAgente(projeto.responsavelId)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {dateFormatter.format(new Date(projeto.prazo))}
                </span>
              </div>

              <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                <button type="button" className="btn-ghost flex-1" onClick={() => abrirEdicao(projeto)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => dispatch({ type: "projeto/remover", payload: { id: projeto.id } })}
                  aria-label={`Excluir ${projeto.nome}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={criando || editando !== null}
        title={editando ? "Editar projeto" : "Novo projeto"}
        description="Projetos e tarefas ficam vinculados no armazenamento local do navegador."
        onClose={fechar}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={fechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar}>
              {editando ? "Salvar alterações" : "Cadastrar projeto"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="projeto-nome">
              Nome
            </label>
            <input
              id="projeto-nome"
              className="field"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              placeholder="Ex.: Observatório de Métricas"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="projeto-descricao">
              Descrição
            </label>
            <textarea
              id="projeto-descricao"
              className="field min-h-[80px]"
              value={form.descricao}
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="projeto-status">
              Status
            </label>
            <select
              id="projeto-status"
              className="field"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as ProjectStatus })
              }
            >
              {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((status) => (
                <option key={status} value={status}>
                  {PROJECT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="projeto-prioridade">
              Prioridade
            </label>
            <select
              id="projeto-prioridade"
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
            <label className="label" htmlFor="projeto-responsavel">
              Responsável
            </label>
            <select
              id="projeto-responsavel"
              className="field"
              value={form.responsavelId ?? ""}
              onChange={(event) =>
                setForm({ ...form, responsavelId: event.target.value || null })
              }
            >
              <option value="">Sem responsável</option>
              {state.agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="projeto-progresso">
              Progresso (%)
            </label>
            <input
              id="projeto-progresso"
              type="number"
              min={0}
              max={100}
              className="field"
              value={form.progresso}
              onChange={(event) => setForm({ ...form, progresso: Number(event.target.value) })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="projeto-prazo">
              Prazo
            </label>
            <input
              id="projeto-prazo"
              type="date"
              className="field"
              value={form.prazo.slice(0, 10)}
              onChange={(event) => setForm({ ...form, prazo: event.target.value })}
            />
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}
      </Modal>
    </div>
  );
}
