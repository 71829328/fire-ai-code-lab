import { PageIdentity } from "../components/ui/PageIdentity";
import { useMemo, useState } from "react";
import { Brain, Cpu, Shield, Sparkles, Workflow, Bot, Filter, Pencil, Plus, Search, ShieldAlert, Trash2 } from "lucide-react";
import { useStore } from "../store/StoreContext";
import { computeStats } from "../store/selectors";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { EmptyState } from "../components/ui/EmptyState";
import { AgentStatusBadge, ConnectionBadge, OrigemBadge } from "../components/ui/badges";
import { ProgressBar } from "../components/charts/Charts";
import { AGENT_STATUS_LABEL, type Agent, type AgentStatus, type Origem } from "../types";

// Campos editáveis no formulário. Origem/conexão/verificação não são editáveis:
// a origem é definida no cadastro e a conexão só muda com verificação real.
type FormState = Omit<
  Agent,
  "id" | "criadoEm" | "origem" | "conexao" | "provedorId" | "verificadoEm"
>;

type OrigemFiltro = "todos" | Origem;

const emptyForm: FormState = {
  nome: "",
  papel: "",
  status: "disponivel",
  modelo: "FIRE-Core 3",
  proficiencia: 70,
  tarefasConcluidas: 0,
  descricao: "",
};

const clampProficiencia = (valor: number) => Math.max(0, Math.min(100, Number(valor) || 0));

export function Agents() {
  const { state, dispatch } = useStore();
  const stats = computeStats(state);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<AgentStatus | "todos">("todos");
  const [filtroOrigem, setFiltroOrigem] = useState<OrigemFiltro>("todos");
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<Agent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [erro, setErro] = useState("");
  const [confirmando, setConfirmando] = useState<Agent | null>(null);

  const agentesFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return state.agentes.filter((agente) => {
      const combinaBusca =
        termo === "" ||
        agente.nome.toLowerCase().includes(termo) ||
        agente.papel.toLowerCase().includes(termo) ||
        agente.modelo.toLowerCase().includes(termo);
      const combinaStatus = filtroStatus === "todos" || agente.status === filtroStatus;
      const combinaOrigem = filtroOrigem === "todos" || agente.origem === filtroOrigem;
      return combinaBusca && combinaStatus && combinaOrigem;
    });
  }, [state.agentes, busca, filtroStatus, filtroOrigem]);

  const abrirCriacao = () => {
    setForm(emptyForm);
    setErro("");
    setEditando(null);
    setCriando(true);
  };

  const abrirEdicao = (agente: Agent) => {
    setForm({
      nome: agente.nome,
      papel: agente.papel,
      status: agente.status,
      modelo: agente.modelo,
      proficiencia: agente.proficiencia,
      tarefasConcluidas: agente.tarefasConcluidas,
      descricao: agente.descricao,
    });
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
    const base = {
      ...form,
      nome: form.nome.trim(),
      papel: form.papel.trim(),
      proficiencia: clampProficiencia(form.proficiencia),
      tarefasConcluidas: Math.max(0, Number(form.tarefasConcluidas) || 0),
    };
    if (editando) {
      // Passa o agente completo; o reducer preserva conexao/verificadoEm.
      dispatch({ type: "agente/atualizar", payload: { ...editando, ...base } });
    } else {
      dispatch({
        type: "agente/criar",
        payload: {
          ...base,
          origem: "cadastrado",
          conexao: "desconectado",
          provedorId: null,
          verificadoEm: null,
        },
      });
    }
    fechar();
  };

  const confirmarExclusao = () => {
    if (!confirmando) return;
    dispatch({ type: "agente/remover", payload: { id: confirmando.id } });
    setConfirmando(null);
  };

  const indicadores = [
    { label: "Total", value: stats.totalAgentes },
    { label: "Cadastrados", value: stats.agentesCadastrados },
    { label: "Demonstrativos", value: stats.agentesDemonstrativos },
    { label: "Conectados", value: stats.agentesConectados },
  ];

  return (
    <div className="fire-page fire-page--agentes space-y-5">
      <PageIdentity page="agentes" />
      <section
        className="fire-metrics grid grid-cols-2 sm:grid-cols-4"
        aria-label="Indicadores de agentes"
      >
        {indicadores.map((item) => (
          <div key={item.label} className="fire-metric">
            <span className="fire-queue-label">{item.label}</span>
            <strong className="fire-queue-value">{item.value}</strong>
          </div>
        ))}
      </section>

      {stats.agentesConectados === 0 && (
        <p className="fire-note">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          Nenhum agente possui conexão verificada — os registros são demonstrativos ou cadastrados
          localmente.
        </p>
      )}

      <div className="fire-toolbar">
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
        <div className="relative sm:w-48">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            className="field pl-9"
            value={filtroStatus}
            onChange={(event) => setFiltroStatus(event.target.value as AgentStatus | "todos")}
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
        <div className="relative sm:w-48">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            className="field pl-9"
            value={filtroOrigem}
            onChange={(event) => setFiltroOrigem(event.target.value as OrigemFiltro)}
            aria-label="Filtrar por origem"
          >
            <option value="todos">Todas as origens</option>
            <option value="cadastrado">Cadastrado</option>
            <option value="demonstrativo">Demonstração</option>
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
          description="Ajuste a busca ou os filtros, ou cadastre um novo agente."
          action={
            <button type="button" className="btn-primary" onClick={abrirCriacao}>
              <Plus className="h-4 w-4" />
              Novo agente
            </button>
          }
        />
      ) : (
        <div className="glass fire-table-wrap">
          <table className="fire-table">
            <caption className="sr-only">Relação de agentes, com identidade individual</caption>
            <thead>
              <tr>
                <th scope="col">Agente</th>
                <th scope="col" className="hidden whitespace-nowrap md:table-cell">Modelo</th>
                <th scope="col">Situação</th>
                <th scope="col">Conexão</th>
                <th scope="col" className="hidden lg:table-cell">Proficiência</th>
                <th scope="col" className="hidden text-center sm:table-cell">Tarefas</th>
                <th scope="col" className="hidden xl:table-cell">Origem</th>
                <th scope="col" className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {agentesFiltrados.map((agente) => {
                const agentSigils: Record<string, typeof Brain> = {
                  Aurora: Sparkles,
                  Vulcano: Cpu,
                  Nebula: Brain,
                  Prisma: Shield,
                  Orion: Workflow,
                };
                const agentTones: Record<string, string> = {
                  Aurora: "aurora",
                  Vulcano: "vulcano",
                  Nebula: "nebula",
                  Prisma: "prisma",
                  Orion: "orion",
                };
                const Avatar = agentSigils[agente.nome] ?? Bot;
                const tone = agentTones[agente.nome] ?? "aurora";
                const tarefas = state.tarefas.filter((t) => t.agenteId === agente.id);
                const concluidas = tarefas.filter((t) => t.status === "concluida").length;
                return (
                  <tr key={agente.id}>
                    <td className="min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <div className={"fire-agent-avatar fire-agent-avatar--" + tone + " flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"}>
                          <Avatar className="h-5 w-5" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <span
                            className="block truncate text-sm font-medium text-slate-100"
                            title={agente.descricao}
                          >
                            {agente.nome}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {agente.papel}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hidden whitespace-nowrap text-sm text-slate-300 md:table-cell">
                      {agente.modelo}
                    </td>
                    <td>
                      <AgentStatusBadge status={agente.status} />
                    </td>
                    <td>
                      <ConnectionBadge conexao={agente.conexao} />
                    </td>
                    <td className="hidden lg:table-cell">
                      <div className="flex min-w-[130px] items-center gap-2">
                        <ProgressBar value={agente.proficiencia} />
                        <span className="text-xs tabular-nums text-slate-300">
                          {agente.proficiencia}%
                        </span>
                      </div>
                    </td>
                    <td className="hidden text-center text-sm tabular-nums text-slate-300 sm:table-cell">
                      {concluidas}/{tarefas.length}
                    </td>
                    <td className="hidden xl:table-cell">
                      <OrigemBadge origem={agente.origem} />
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost !px-2.5 !py-1.5 text-xs"
                          onClick={() => abrirEdicao(agente)}
                          aria-label={`Editar ${agente.nome}`}
                          title="Editar agente"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn-danger !px-2.5 !py-1.5 text-xs"
                          onClick={() => setConfirmando(agente)}
                          aria-label={`Excluir ${agente.nome}`}
                          title="Excluir agente"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={criando || editando !== null}
        title={editando ? "Editar agente" : "Novo agente"}
        description={
          editando
            ? "A conexão e a verificação não mudam pela edição; apenas uma integração real as altera."
            : "Agentes cadastrados aqui entram como locais, sem conexão verificada."
        }
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
              onChange={(event) => setForm({ ...form, proficiencia: Number(event.target.value) })}
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

      <ConfirmDialog
        open={confirmando !== null}
        title="Excluir agente"
        description={
          confirmando
            ? `Tem certeza que deseja excluir "${confirmando.nome}"? Vínculos com projetos, tarefas e missões serão desfeitos.`
            : ""
        }
        confirmLabel="Excluir"
        tone="danger"
        onConfirm={confirmarExclusao}
        onCancel={() => setConfirmando(null)}
      />
    </div>
  );
}
