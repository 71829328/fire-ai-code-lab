import { useMemo, useState } from "react";
import { Bot, Filter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { AgentStatusBadge, DemoBadge } from "../components/ui/badges";
import { ProgressBar } from "../components/charts/Charts";
import {
  AGENT_STATUS_LABEL,
  type Agent,
  type AgentStatus,
} from "../types";

type FormState = Omit<Agent, "id" | "criadoEm" | "demo">;

const emptyForm: FormState = {
  nome: "",
  papel: "",
  status: "ativo",
  modelo: "FIRE-Core 3",
  proficiencia: 70,
  tarefasConcluidas: 0,
  descricao: "",
};

export function Agents() {
  const { state, dispatch } = useStore();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<AgentStatus | "todos">("todos");
  const [editando, setEditando] = useState<Agent | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erro, setErro] = useState("");

  const agentesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return state.agentes.filter((agente) => {
      const combinaBusca =
        termo === "" ||
        agente.nome.toLowerCase().includes(termo) ||
        agente.papel.toLowerCase().includes(termo) ||
        agente.modelo.toLowerCase().includes(termo);
      const combinaFiltro = filtro === "todos" || agente.status === filtro;
      return combinaBusca && combinaFiltro;
    });
  }, [state.agentes, busca, filtro]);

  const abrirCriacao = () => {
    setForm(emptyForm);
    setErro("");
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (agente: Agent) => {
    const { id: _id, criadoEm: _criadoEm, demo: _demo, ...rest } = agente;
    setForm(rest);
    setErro("");
    setCriando(false);
    setEditando(agente);
  };

  const fechar = () => {
    setCriando(false);
    setEditando(null);
    setErro("");
  };

  const salvar = () => {
    if (!form.nome.trim() || !form.papel.trim()) {
      setErro("Informe ao menos o nome e o papel do agente.");
      return;
    }
    const payload: FormState = {
      ...form,
      nome: form.nome.trim(),
      papel: form.papel.trim(),
      proficiencia: Math.max(0, Math.min(100, Number(form.proficiencia) || 0)),
      tarefasConcluidas: Math.max(0, Number(form.tarefasConcluidas) || 0),
    };
    if (editando) {
      dispatch({ type: "agente/atualizar", payload: { ...editando, ...payload } });
    } else {
      dispatch({ type: "agente/criar", payload });
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
            placeholder="Buscar por nome, papel ou modelo..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar agentes"
          />
        </div>
        <div className="relative sm:w-52">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            className="field pl-9"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as AgentStatus | "todos")}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(AGENT_STATUS_LABEL) as AgentStatus[]).map((status) => (
              <option key={status} value={status}>
                {AGENT_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-primary" onClick={abrirCriacao}>
          <Plus className="h-4 w-4" />
          Novo agente
        </button>
      </div>

      {agentesFiltrados.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-5 w-5" />}
          title="Nenhum agente encontrado"
          description="Ajuste a busca ou os filtros, ou cadastre um novo agente demonstrativo."
          action={
            <button type="button" className="btn-primary" onClick={abrirCriacao}>
              <Plus className="h-4 w-4" />
              Novo agente
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 stagger">
          {agentesFiltrados.map((agente) => {
            const tarefas = state.tarefas.filter((t) => t.agenteId === agente.id);
            const concluidas = tarefas.filter((t) => t.status === "concluida").length;
            return (
              <article key={agente.id} className="glass glass-hover flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fire-gradient text-night-950 shadow-glow">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-50">{agente.nome}</h3>
                      <p className="text-xs text-slate-400">{agente.papel}</p>
                    </div>
                  </div>
                  {agente.demo && <DemoBadge compact />}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <AgentStatusBadge status={agente.status} />
                  <span className="chip border-white/10 bg-white/5 text-slate-300">
                    {agente.modelo}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm text-slate-400">{agente.descricao}</p>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Proficiência</span>
                    <span className="font-semibold text-slate-200">{agente.proficiencia}%</span>
                  </div>
                  <ProgressBar value={agente.proficiencia} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
                  <div className="glass-soft px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                      Tarefas
                    </dt>
                    <dd className="text-lg font-bold text-slate-100">{tarefas.length}</dd>
                  </div>
                  <div className="glass-soft px-3 py-2">
                    <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                      Concluídas
                    </dt>
                    <dd className="text-lg font-bold text-slate-100">
                      {concluidas || agente.tarefasConcluidas}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    className="btn-ghost flex-1"
                    onClick={() => abrirEdicao(agente)}
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => dispatch({ type: "agente/remover", payload: { id: agente.id } })}
                    aria-label={`Excluir ${agente.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={criando || editando !== null}
        title={editando ? "Editar agente" : "Novo agente"}
        description="Os dados ficam salvos apenas neste navegador (armazenamento local)."
        onClose={fechar}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={fechar}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={salvar}>
              {editando ? "Salvar alterações" : "Cadastrar agente"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="agente-nome">
              Nome
            </label>
            <input
              id="agente-nome"
              className="field"
              value={form.nome}
              onChange={(event) => setForm({ ...form, nome: event.target.value })}
              placeholder="Ex.: Aurora"
            />
          </div>
          <div>
            <label className="label" htmlFor="agente-papel">
              Papel
            </label>
            <input
              id="agente-papel"
              className="field"
              value={form.papel}
              onChange={(event) => setForm({ ...form, papel: event.target.value })}
              placeholder="Ex.: Analista de Dados"
            />
          </div>
          <div>
            <label className="label" htmlFor="agente-modelo">
              Modelo
            </label>
            <input
              id="agente-modelo"
              className="field"
              value={form.modelo}
              onChange={(event) => setForm({ ...form, modelo: event.target.value })}
            />
          </div>
          <div>
            <label className="label" htmlFor="agente-status">
              Status
            </label>
            <select
              id="agente-status"
              className="field"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as AgentStatus })
              }
            >
              {(Object.keys(AGENT_STATUS_LABEL) as AgentStatus[]).map((status) => (
                <option key={status} value={status}>
                  {AGENT_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="agente-proficiencia">
              Proficiência (%)
            </label>
            <input
              id="agente-proficiencia"
              type="number"
              min={0}
              max={100}
              className="field"
              value={form.proficiencia}
              onChange={(event) =>
                setForm({ ...form, proficiencia: Number(event.target.value) })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="agente-descricao">
              Descrição
            </label>
            <textarea
              id="agente-descricao"
              className="field min-h-[80px]"
              value={form.descricao}
              onChange={(event) => setForm({ ...form, descricao: event.target.value })}
              placeholder="Resumo das responsabilidades do agente."
            />
          </div>
        </div>
        {erro && <p className="mt-3 text-sm text-rose-300">{erro}</p>}
      </Modal>
    </div>
  );
}
