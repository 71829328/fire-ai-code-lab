import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  Bot,
  Cpu,
  Database,
  FolderKanban,
  ListChecks,
  Plug,
  Search,
  Target,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { EmptyState } from "../components/ui/EmptyState";
import type { ActivityType } from "../types";

const tipoLabel: Record<ActivityType, string> = {
  agente: "Agente",
  projeto: "Projeto",
  tarefa: "Tarefa",
  missao: "Missão",
  integracao: "Integração",
  execucao: "Execução",
  sistema: "Sistema",
  backup: "Backup",
};

const tipoIcon: Record<ActivityType, typeof ActivityIcon> = {
  agente: Bot,
  projeto: FolderKanban,
  tarefa: ListChecks,
  missao: Target,
  integracao: Plug,
  execucao: Cpu,
  sistema: ActivityIcon,
  backup: Database,
};

const tipoCor: Record<ActivityType, string> = {
  agente: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  projeto: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  tarefa: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  missao: "text-fire border-fire/30 bg-fire/10",
  integracao: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10",
  execucao: "text-violet-300 border-violet-400/30 bg-violet-400/10",
  sistema: "text-slate-300 border-white/10 bg-white/5",
  backup: "text-slate-300 border-white/10 bg-white/5",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function History() {
  const { state } = useStore();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<ActivityType | "todos">("todos");

  const atividadesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return state.atividades.filter((atividade) => {
      const combinaBusca =
        termo === "" ||
        atividade.alvo.toLowerCase().includes(termo) ||
        atividade.acao.toLowerCase().includes(termo) ||
        (atividade.detalhe ?? "").toLowerCase().includes(termo);
      const combinaFiltro = filtro === "todos" || atividade.tipo === filtro;
      return combinaBusca && combinaFiltro;
    });
  }, [state.atividades, busca, filtro]);

  return (
    <div className="fire-page fire-page--historico space-y-5">
      <div className="glass flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="field pl-9"
            placeholder="Buscar no histórico..."
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            aria-label="Buscar no histórico"
          />
        </div>
        <select
          className="field sm:w-52"
          value={filtro}
          onChange={(event) => setFiltro(event.target.value as ActivityType | "todos")}
          aria-label="Filtrar por tipo"
        >
          <option value="todos">Todos os tipos</option>
          {(Object.keys(tipoLabel) as ActivityType[]).map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipoLabel[tipo]}
            </option>
          ))}
        </select>
      </div>

      {atividadesFiltradas.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="h-5 w-5" />}
          title="Nenhuma atividade encontrada"
          description="As ações realizadas no painel aparecem aqui automaticamente."
        />
      ) : (
        <ol className="relative space-y-3 border-l border-white/10 pl-5">
          {atividadesFiltradas.map((atividade) => {
            const Icon = tipoIcon[atividade.tipo];
            return (
              <li key={atividade.id} className="relative">
                <span
                  className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border ${tipoCor[atividade.tipo]}`}
                  aria-hidden
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="glass-soft p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-200">
                      <span className="text-slate-400">{atividade.acao} </span>
                      <span className="font-semibold">{atividade.alvo}</span>
                    </p>
                    <span className="chip border-white/10 bg-white/5 text-slate-300">
                      {tipoLabel[atividade.tipo]}
                    </span>
                  </div>
                  {atividade.detalhe && (
                    <p className="mt-1 text-xs text-slate-400">{atividade.detalhe}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {dateFormatter.format(new Date(atividade.timestamp))}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
