import { useState, type ReactNode } from "react";
import {
  Bot,
  ChevronLeft,
  FolderKanban,
  History,
  KanbanSquare,
  LayoutDashboard,
  Menu,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { DemoBadge } from "../ui/badges";
import { useStore } from "../../store/StoreContext";

export type PageKey = "dashboard" | "agentes" | "projetos" | "kanban" | "historico";

export const NAV_ITEMS: { key: PageKey; label: string; icon: typeof Bot }[] = [
  { key: "dashboard", label: "Painel", icon: LayoutDashboard },
  { key: "agentes", label: "Agentes", icon: Bot },
  { key: "projetos", label: "Projetos", icon: FolderKanban },
  { key: "kanban", label: "Quadro Kanban", icon: KanbanSquare },
  { key: "historico", label: "Histórico", icon: History },
];

interface AppShellProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AppShell({ page, onNavigate, title, subtitle, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dispatch } = useStore();

  const handleNavigate = (key: PageKey) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* Camada de fundo do menu em telas pequenas */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-night-950/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        page={page}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={handleNavigate}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-night-950/70 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              type="button"
              className="btn-ghost !px-2.5 !py-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-semibold text-slate-50 sm:text-xl">
                {title}
              </h1>
              <p className="truncate text-xs text-slate-400 sm:text-sm">{subtitle}</p>
            </div>
            <DemoBadge compact />
            <button
              type="button"
              className="btn-ghost hidden !px-3 sm:inline-flex"
              onClick={() => dispatch({ type: "estado/resetar" })}
              title="Restaurar os dados demonstrativos iniciais"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden md:inline">Restaurar demo</span>
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div key={page} className="animate-fade-up">
            {children}
          </div>
        </main>

        <footer className="border-t border-white/10 px-4 py-4 text-xs text-slate-500 sm:px-6">
          FIRE Agent Command Center · aplicação demonstrativa. Os registros marcados como
          “Demonstração” são dados de exemplo — nenhum agente está conectado a serviços reais.
        </footer>
      </div>
    </div>
  );
}

function Sidebar({
  page,
  collapsed,
  mobileOpen,
  onNavigate,
  onToggleCollapse,
  onCloseMobile,
}: {
  page: PageKey;
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: (page: PageKey) => void;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <aside
      className={[
        "z-40 flex shrink-0 flex-col border-r border-white/10 bg-night-900/80 backdrop-blur-xl transition-all duration-300",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-[84px]" : "lg:w-64",
        "w-64",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fire-gradient shadow-glow">
          <Sparkles className="h-5 w-5 text-night-950" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-slate-50">
              FIRE COMMAND
            </p>
            <p className="truncate text-[11px] text-slate-400">CENTRO DE AGENTES</p>
          </div>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={[
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "border border-fire/40 bg-fire/10 text-fire-soft shadow-glow"
                  : "border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-slate-100",
                collapsed ? "lg:justify-center" : "",
              ].join(" ")}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="glass-soft m-3 p-3 text-[11px] leading-relaxed text-slate-400">
          <p className="font-semibold text-amber-200">Dados demonstrativos</p>
          <p className="mt-1">
            Os agentes listados são exemplos locais. Nenhuma API paga, credencial externa ou
            serviço comercial é utilizado.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-semibold text-slate-400 transition hover:text-slate-100 lg:flex"
        aria-label="Recolher menu"
      >
        <ChevronLeft
          className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`}
        />
        {!collapsed && <span>Recolher menu</span>}
      </button>
    </aside>
  );
}
