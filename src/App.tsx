import { useState } from "react";
import { AppShell, type PageKey } from "./components/layout/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Missions } from "./pages/Missions";
import { Approvals } from "./pages/Approvals";
import { Orchestration } from "./pages/Orchestration";
import { EvidenceCenter } from "./pages/EvidenceCenter";
import { AgentIntelligence } from "./pages/AgentIntelligence";
import { AgentAdapters } from "./pages/AgentAdapters";
import { Governance } from "./pages/Governance";
import { Agents } from "./pages/Agents";
import { Projects } from "./pages/Projects";
import { Kanban } from "./pages/Kanban";
import { LocalExecutor } from "./pages/LocalExecutor";
import { Integrations } from "./pages/Integrations";
import { Conexoes } from "./pages/Conexoes";
import { History } from "./pages/History";
import { DataBackup } from "./pages/DataBackup";
import { CodeLab } from "./pages/CodeLab";

const PAGINAS: Record<PageKey, { titulo: string; subtitulo: string }> = {
  dashboard: {
    titulo: "Painel Operacional",
    subtitulo: "Indicadores honestos de agentes, missões, projetos e tarefas.",
  },
  missoes: {
    titulo: "Central de Missões",
    subtitulo: "Cadastre, acompanhe e documente missões de inteligência artificial.",
  },
  aprovacoes: {
    titulo: "Painel de Aprovação",
    subtitulo: "Revisão técnica das missões aguardando aprovação.",
  },
  orquestracao: {
    titulo: "Orquestração de Missões",
    subtitulo: "Fila, prioridades, dependências, concorrência, timeout e aprovação humana.",
  },
  evidencias: {
    titulo: "Central de Evidências",
    subtitulo: "Separação clara entre evidências informadas e verificadas independentemente.",
  },
  inteligencia: {
    titulo: "Inteligência Operacional",
    subtitulo: "Métricas e recomendação calculadas apenas com dados observados.",
  },
  adaptadores: {
    titulo: "Adaptadores de Agentes",
    subtitulo: "Status real de cada integração e fluxo manual assistido quando não autorizada.",
  },
  governanca: {
    titulo: "Governança e Auditoria",
    subtitulo: "Organizações, papéis, permissões, consumo informado e trilha de auditoria.",
  },
  agentes: {
    titulo: "Agentes",
    subtitulo: "Diferencie agentes cadastrados, demonstrativos e conectados.",
  },
  projetos: {
    titulo: "Projetos",
    subtitulo: "Organize iniciativas, responsáveis e prazos.",
  },
  kanban: {
    titulo: "Quadro Kanban",
    subtitulo: "Movimente tarefas por toque, teclado ou arraste, sem perder a ordem.",
  },
  executor: {
    titulo: "Executor Local de Demonstração",
    subtitulo: "Execução local verificável — distinta de execução por IA.",
  },
  integracoes: {
    titulo: "Integrações",
    subtitulo: "Interfaces operacionais desativadas até haver acesso real autorizado.",
  },
  conexoes: {
    titulo: "Central de Conexões",
    subtitulo: "Estado real do backend e dos provedores: configurado, autorizado, conectado e verificado.",
  },
  historico: {
    titulo: "Histórico de Atividades",
    subtitulo: "Linha do tempo das ações realizadas na central.",
  },
  dados: {
    titulo: "Dados & Backup",
    subtitulo: "Validação, exportação e importação segura do estado da aplicação.",
  },
  codelab: {
    titulo: "Code Lab",
    subtitulo: "Analisador estático de código preservado em módulo separado.",
  },
};

export default function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const { titulo, subtitulo } = PAGINAS[page];

  return (
    <AppShell page={page} onNavigate={setPage} title={titulo} subtitle={subtitulo}>
      {page === "dashboard" && <Dashboard />}
      {page === "missoes" && <Missions />}
      {page === "aprovacoes" && <Approvals />}
      {page === "orquestracao" && <Orchestration />}
      {page === "evidencias" && <EvidenceCenter />}
      {page === "inteligencia" && <AgentIntelligence />}
      {page === "adaptadores" && <AgentAdapters />}
      {page === "governanca" && <Governance />}
      {page === "agentes" && <Agents />}
      {page === "projetos" && <Projects />}
      {page === "kanban" && <Kanban />}
      {page === "executor" && <LocalExecutor />}
      {page === "integracoes" && <Integrations />}
      {page === "conexoes" && <Conexoes />}
      {page === "historico" && <History />}
      {page === "dados" && <DataBackup />}
      {page === "codelab" && <CodeLab />}
    </AppShell>
  );
}
