import type {
  Activity,
  ActivityType,
  Agent,
  AppState,
  Project,
  Task,
  TaskStatus,
} from "../types";
import { createSeedState } from "../data/seed";

let idCounter = 0;
export function genId(prefix: string): string {
  idCounter += 1;
  const random =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}-${idCounter}`;
}

function makeActivity(
  tipo: ActivityType,
  acao: string,
  alvo: string,
  detalhe?: string
): Activity {
  return {
    id: genId("ac"),
    tipo,
    acao,
    alvo,
    detalhe,
    timestamp: new Date().toISOString(),
  };
}

const MAX_ACTIVITIES = 200;
const withActivity = (state: AppState, activity: Activity): Activity[] =>
  [activity, ...state.atividades].slice(0, MAX_ACTIVITIES);

export type Action =
  | { type: "agente/criar"; payload: Omit<Agent, "id" | "criadoEm" | "demo"> }
  | { type: "agente/atualizar"; payload: Agent }
  | { type: "agente/remover"; payload: { id: string } }
  | { type: "projeto/criar"; payload: Omit<Project, "id" | "criadoEm" | "demo"> }
  | { type: "projeto/atualizar"; payload: Project }
  | { type: "projeto/remover"; payload: { id: string } }
  | { type: "tarefa/criar"; payload: Omit<Task, "id" | "criadoEm" | "demo"> }
  | { type: "tarefa/atualizar"; payload: Task }
  | { type: "tarefa/remover"; payload: { id: string } }
  | { type: "tarefa/mover"; payload: { id: string; status: TaskStatus; ordem: number } }
  | { type: "estado/resetar" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "agente/criar": {
      const agente: Agent = {
        ...action.payload,
        id: genId("ag"),
        criadoEm: new Date().toISOString(),
        demo: false,
      };
      return {
        ...state,
        agentes: [agente, ...state.agentes],
        atividades: withActivity(
          state,
          makeActivity("agente", "cadastrou o agente", agente.nome, agente.papel)
        ),
      };
    }
    case "agente/atualizar": {
      const atual = state.agentes.find((a) => a.id === action.payload.id);
      const mudouStatus = atual && atual.status !== action.payload.status;
      return {
        ...state,
        agentes: state.agentes.map((a) =>
          a.id === action.payload.id ? { ...action.payload, demo: a.demo } : a
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "agente",
            mudouStatus ? "atualizou o status de" : "editou o agente",
            action.payload.nome,
            mudouStatus
              ? `Novo status informado na edição`
              : action.payload.papel
          )
        ),
      };
    }
    case "agente/remover": {
      const alvo = state.agentes.find((a) => a.id === action.payload.id);
      return {
        ...state,
        agentes: state.agentes.filter((a) => a.id !== action.payload.id),
        projetos: state.projetos.map((p) =>
          p.responsavelId === action.payload.id ? { ...p, responsavelId: null } : p
        ),
        tarefas: state.tarefas.map((t) =>
          t.agenteId === action.payload.id ? { ...t, agenteId: null } : t
        ),
        atividades: alvo
          ? withActivity(state, makeActivity("agente", "removeu o agente", alvo.nome))
          : state.atividades,
      };
    }
    case "projeto/criar": {
      const projeto: Project = {
        ...action.payload,
        id: genId("pr"),
        criadoEm: new Date().toISOString(),
        demo: false,
      };
      return {
        ...state,
        projetos: [projeto, ...state.projetos],
        atividades: withActivity(
          state,
          makeActivity("projeto", "criou o projeto", projeto.nome, projeto.descricao)
        ),
      };
    }
    case "projeto/atualizar": {
      const atual = state.projetos.find((p) => p.id === action.payload.id);
      const mudouStatus = atual && atual.status !== action.payload.status;
      return {
        ...state,
        projetos: state.projetos.map((p) =>
          p.id === action.payload.id ? { ...action.payload, demo: p.demo } : p
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "projeto",
            mudouStatus ? "atualizou o status de" : "editou o projeto",
            action.payload.nome,
            mudouStatus ? `Novo status informado na edição` : action.payload.descricao
          )
        ),
      };
    }
    case "projeto/remover": {
      const alvo = state.projetos.find((p) => p.id === action.payload.id);
      return {
        ...state,
        projetos: state.projetos.filter((p) => p.id !== action.payload.id),
        tarefas: state.tarefas.map((t) =>
          t.projetoId === action.payload.id ? { ...t, projetoId: null } : t
        ),
        atividades: alvo
          ? withActivity(state, makeActivity("projeto", "removeu o projeto", alvo.nome))
          : state.atividades,
      };
    }
    case "tarefa/criar": {
      const tarefa: Task = {
        ...action.payload,
        id: genId("tk"),
        criadoEm: new Date().toISOString(),
        demo: false,
      };
      return {
        ...state,
        tarefas: [tarefa, ...state.tarefas],
        atividades: withActivity(
          state,
          makeActivity("tarefa", "criou a tarefa", tarefa.titulo, tarefa.descricao)
        ),
      };
    }
    case "tarefa/atualizar": {
      const atual = state.tarefas.find((t) => t.id === action.payload.id);
      const mudouStatus = atual && atual.status !== action.payload.status;
      return {
        ...state,
        tarefas: state.tarefas.map((t) =>
          t.id === action.payload.id ? { ...action.payload, demo: t.demo } : t
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "tarefa",
            mudouStatus ? "moveu a tarefa" : "editou a tarefa",
            action.payload.titulo,
            mudouStatus ? `Status atualizado na edição` : action.payload.descricao
          )
        ),
      };
    }
    case "tarefa/remover": {
      const alvo = state.tarefas.find((t) => t.id === action.payload.id);
      return {
        ...state,
        tarefas: state.tarefas.filter((t) => t.id !== action.payload.id),
        atividades: alvo
          ? withActivity(state, makeActivity("tarefa", "removeu a tarefa", alvo.titulo))
          : state.atividades,
      };
    }
    case "tarefa/mover": {
      const alvo = state.tarefas.find((t) => t.id === action.payload.id);
      if (!alvo || alvo.status === action.payload.status) return state;
      const destino = action.payload.status;
      return {
        ...state,
        tarefas: state.tarefas.map((t) =>
          t.id === action.payload.id
            ? { ...t, status: destino, ordem: action.payload.ordem }
            : t
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "tarefa",
            "moveu a tarefa",
            alvo.titulo,
            `Novo status: ${destino}`
          )
        ),
      };
    }
    case "estado/resetar":
      return createSeedState();
    default:
      return state;
  }
}

export function initialState(): AppState {
  return createSeedState();
}
