import { useState } from "react";
import { AppShell, type PageKey } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Agents } from "./pages/Agents";
import { Projects } from "./pages/Projects";
import { Kanban } from "./pages/Kanban";
import { History } from "./pages/History";

const PAGINAS: Record<PageKey, { titulo: string; subtitulo: string }> = {
  dashboard: {
    titulo: "Painel de Controle",
    subtitulo: "Visão geral de agentes, projetos e tarefas.",
  },
  agentes: {
    titulo: "Agentes",
    subtitulo: "Cadastre, edite e gerencie os agentes do painel.",
  },
  projetos: {
    titulo: "Projetos",
    subtitulo: "Organize iniciativas, responsáveis e prazos.",
  },
  kanban: {
    titulo: "Quadro Kanban",
    subtitulo: "Acompanhe tarefas pendentes, em execução e concluídas.",
  },
  historico: {
    titulo: "Histórico de Atividades",
    subtitulo: "Linha do tempo das ações realizadas no painel.",
  },
};

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const { titulo, subtitulo } = PAGINAS[page];

  return (
    <AppShell page={page} onNavigate={setPage} title={titulo} subtitle={subtitulo}>
      {page === "dashboard" && <Dashboard />}
      {page === "agentes" && <Agents />}
      {page === "projetos" && <Projects />}
      {page === "kanban" && <Kanban />}
      {page === "historico" && <History />}
    </AppShell>
  );
}
