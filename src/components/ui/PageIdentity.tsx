import {
  BadgeCheck, Bot, Brain, Boxes, Building2, Code2, Cpu, FileCheck2, FolderKanban,
  History, KanbanSquare, Plug, PlugZap, Target, Workflow,
  type LucideIcon,
} from "lucide-react";

type PageIdentityKey =
  | "missoes" | "aprovacoes" | "orquestracao" | "evidencias" | "inteligencia"
  | "adaptadores" | "governanca" | "agentes" | "projetos" | "kanban"
  | "executor" | "integracoes" | "conexoes" | "historico" | "dados" | "codelab";

const IDENTITIES: Record<PageIdentityKey, { index: string; domain: string; focus: string; icon: LucideIcon }> = {
  missoes: { index: "02", domain: "MISSION CONTROL", focus: "Fila, prioridade e rastreabilidade", icon: Target },
  aprovacoes: { index: "03", domain: "HUMAN REVIEW", focus: "Decisões e critérios registrados", icon: BadgeCheck },
  orquestracao: { index: "04", domain: "ORCHESTRATION", focus: "Execução local e dependências", icon: Workflow },
  evidencias: { index: "05", domain: "EVIDENCE ROOM", focus: "Origem, referência e verificação", icon: FileCheck2 },
  inteligencia: { index: "06", domain: "INTELLIGENCE", focus: "Métricas observadas e recomendação", icon: Brain },
  adaptadores: { index: "07", domain: "AGENT ADAPTERS", focus: "Fluxos assistidos e estados reais", icon: Boxes },
  governanca: { index: "08", domain: "GOVERNANCE", focus: "Acesso, papéis e trilha de auditoria", icon: Building2 },
  agentes: { index: "09", domain: "AGENT REGISTRY", focus: "Identidade, papel e conexão", icon: Bot },
  projetos: { index: "10", domain: "PROJECT OFFICE", focus: "Responsáveis, prazo e progresso", icon: FolderKanban },
  kanban: { index: "11", domain: "TASK FLOW", focus: "Movimento e ordenação de tarefas", icon: KanbanSquare },
  executor: { index: "12", domain: "LOCAL EXECUTOR", focus: "Demonstração controlada neste navegador", icon: Cpu },
  integracoes: { index: "13", domain: "INTEGRATIONS", focus: "Acesso externo permanece sob autorização", icon: Plug },
  conexoes: { index: "14", domain: "CONNECTION STATUS", focus: "Configuração, acesso e verificação", icon: PlugZap },
  historico: { index: "15", domain: "ACTIVITY LOG", focus: "Eventos registrados na central", icon: History },
  dados: { index: "16", domain: "DATA VAULT", focus: "Backup, validação e restauração", icon: Boxes },
  codelab: { index: "17", domain: "CODE LAB", focus: "Análise estática local", icon: Code2 },
};

export function PageIdentity({ page }: { page: PageIdentityKey }) {
  const item = IDENTITIES[page];
  const Icon = item.icon;
  return (
    <div className={"fire-module-identity fire-module-identity--" + page}>
      <span className="fire-module-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.7} /></span>
      <div className="fire-module-copy">
        <p><span>FIRE / {item.index}</span><i aria-hidden="true" />{item.domain}</p>
        <strong>{item.focus}</strong>
      </div>
      <span className="fire-module-mark" aria-hidden="true">{item.index}</span>
    </div>
  );
}
