import type {
  Activity,
  ActivityType,
  Agent,
  AppState,
  IntegrationProviderId,
  LocalExecution,
  Mission,
  MissionEvidence,
  MissionStatus,
  Project,
  Task,
  TaskStatus,
} from "../types";
import { createSeedState } from "../data/seed";
import { moverParaColuna, normalizarColuna } from "../domain/ordering";

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

// Gera o próximo código legível de missão (MSN-0001, MSN-0002...).
export function proximoCodigoMissao(missoes: Mission[]): string {
  const maior = missoes.reduce((max, missao) => {
    const numero = Number.parseInt(missao.codigo.replace(/\D/g, ""), 10);
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);
  return `MSN-${String(maior + 1).padStart(4, "0")}`;
}

export type Action =
  | { type: "agente/criar"; payload: Omit<Agent, "id" | "criadoEm"> }
  | { type: "agente/atualizar"; payload: Agent }
  | { type: "agente/remover"; payload: { id: string } }
  | { type: "projeto/criar"; payload: Omit<Project, "id" | "criadoEm"> }
  | { type: "projeto/atualizar"; payload: Project }
  | { type: "projeto/remover"; payload: { id: string } }
  | { type: "tarefa/criar"; payload: Omit<Task, "id" | "criadoEm"> }
  | { type: "tarefa/atualizar"; payload: Task }
  | { type: "tarefa/remover"; payload: { id: string } }
  | { type: "tarefa/mover"; payload: { id: string; status: TaskStatus } }
  | {
      type: "missao/criar";
      payload: Omit<Mission, "id" | "codigo" | "evidencias" | "historico" | "criadoEm" | "atualizadoEm">;
    }
  | { type: "missao/atualizar"; payload: Mission }
  | { type: "missao/remover"; payload: { id: string } }
  | { type: "missao/status"; payload: { id: string; status: MissionStatus; descricao?: string } }
  | {
      type: "missao/evidencia/adicionar";
      payload: { id: string; evidencia: Omit<MissionEvidence, "id" | "timestamp"> };
    }
  | { type: "missao/evidencia/remover"; payload: { id: string; evidenciaId: string } }
  | { type: "integracao/solicitar"; payload: { id: IntegrationProviderId } }
  | { type: "integracao/desativar"; payload: { id: IntegrationProviderId } }
  | { type: "execucao/registrar"; payload: LocalExecution }
  | { type: "estado/importar"; payload: AppState }
  | { type: "estado/resetar" };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    /* -------------------------------------------------- agentes */
    case "agente/criar": {
      const agente: Agent = {
        ...action.payload,
        id: genId("ag"),
        criadoEm: new Date().toISOString(),
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
          // A conexão nunca é editada por formulário: permanece a validada no cadastro.
          a.id === action.payload.id
            ? { ...action.payload, conexao: a.conexao, verificadoEm: a.verificadoEm }
            : a
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "agente",
            mudouStatus ? "atualizou o status de" : "editou o agente",
            action.payload.nome,
            mudouStatus ? "Novo status informado na edição" : action.payload.papel
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
        missoes: state.missoes.map((m) =>
          m.agenteId === action.payload.id ? { ...m, agenteId: null } : m
        ),
        atividades: alvo
          ? withActivity(state, makeActivity("agente", "removeu o agente", alvo.nome))
          : state.atividades,
      };
    }

    /* -------------------------------------------------- projetos */
    case "projeto/criar": {
      const projeto: Project = {
        ...action.payload,
        id: genId("pr"),
        criadoEm: new Date().toISOString(),
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
          p.id === action.payload.id ? action.payload : p
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "projeto",
            mudouStatus ? "atualizou o status de" : "editou o projeto",
            action.payload.nome,
            mudouStatus ? "Novo status informado na edição" : action.payload.descricao
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
        missoes: state.missoes.map((m) =>
          m.projetoId === action.payload.id ? { ...m, projetoId: null } : m
        ),
        atividades: alvo
          ? withActivity(state, makeActivity("projeto", "removeu o projeto", alvo.nome))
          : state.atividades,
      };
    }

    /* -------------------------------------------------- tarefas */
    case "tarefa/criar": {
      const tarefa: Task = {
        ...action.payload,
        id: genId("tk"),
        criadoEm: new Date().toISOString(),
      };
      return {
        ...state,
        tarefas: normalizarColuna([tarefa, ...state.tarefas], tarefa.status),
        atividades: withActivity(
          state,
          makeActivity("tarefa", "criou a tarefa", tarefa.titulo, tarefa.descricao)
        ),
      };
    }
    case "tarefa/atualizar": {
      const atual = state.tarefas.find((t) => t.id === action.payload.id);
      const mudouStatus = atual && atual.status !== action.payload.status;
      const atualizadas = state.tarefas.map((t) =>
        t.id === action.payload.id ? action.payload : t
      );
      return {
        ...state,
        // Se o status mudou na edição, reordena as duas colunas afetadas.
        tarefas: mudouStatus
          ? normalizarColuna(
              normalizarColuna(atualizadas, atual.status),
              action.payload.status
            )
          : atualizadas,
        atividades: withActivity(
          state,
          makeActivity(
            "tarefa",
            mudouStatus ? "moveu a tarefa" : "editou a tarefa",
            action.payload.titulo,
            mudouStatus ? "Status atualizado na edição" : action.payload.descricao
          )
        ),
      };
    }
    case "tarefa/remover": {
      const alvo = state.tarefas.find((t) => t.id === action.payload.id);
      if (!alvo) return state;
      return {
        ...state,
        tarefas: normalizarColuna(
          state.tarefas.filter((t) => t.id !== action.payload.id),
          alvo.status
        ),
        atividades: withActivity(state, makeActivity("tarefa", "removeu a tarefa", alvo.titulo)),
      };
    }
    case "tarefa/mover": {
      const alvo = state.tarefas.find((t) => t.id === action.payload.id);
      if (!alvo || alvo.status === action.payload.status) return state;
      return {
        ...state,
        tarefas: moverParaColuna(state.tarefas, action.payload.id, action.payload.status),
        atividades: withActivity(
          state,
          makeActivity("tarefa", "moveu a tarefa", alvo.titulo, `Novo status: ${action.payload.status}`)
        ),
      };
    }

    /* -------------------------------------------------- missões */
    case "missao/criar": {
      const agora = new Date().toISOString();
      const codigo = proximoCodigoMissao(state.missoes);
      const missao: Mission = {
        ...action.payload,
        id: genId("ms"),
        codigo,
        evidencias: [],
        historico: [
          {
            id: genId("hi"),
            status: action.payload.status,
            descricao: "Missão cadastrada",
            timestamp: agora,
          },
        ],
        criadoEm: agora,
        atualizadoEm: agora,
      };
      return {
        ...state,
        missoes: [missao, ...state.missoes],
        atividades: withActivity(
          state,
          makeActivity("missao", "cadastrou a missão", `${missao.codigo} — ${missao.titulo}`)
        ),
      };
    }
    case "missao/atualizar": {
      const atual = state.missoes.find((m) => m.id === action.payload.id);
      if (!atual) return state;
      const mudouStatus = atual.status !== action.payload.status;
      const agora = new Date().toISOString();
      const historico = mudouStatus
        ? [
            ...action.payload.historico,
            {
              id: genId("hi"),
              status: action.payload.status,
              descricao: "Status atualizado na edição",
              timestamp: agora,
            },
          ]
        : action.payload.historico;
      return {
        ...state,
        missoes: state.missoes.map((m) =>
          m.id === action.payload.id
            ? { ...action.payload, historico, atualizadoEm: agora }
            : m
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "missao",
            mudouStatus ? "atualizou o status da missão" : "editou a missão",
            action.payload.codigo
          )
        ),
      };
    }
    case "missao/remover": {
      const alvo = state.missoes.find((m) => m.id === action.payload.id);
      if (!alvo) return state;
      return {
        ...state,
        missoes: state.missoes
          .filter((m) => m.id !== action.payload.id)
          // Remove a referência das dependências que apontavam para a missão excluída.
          .map((m) => ({
            ...m,
            dependencias: m.dependencias.filter((dep) => dep !== action.payload.id),
          })),
        atividades: withActivity(
          state,
          makeActivity("missao", "removeu a missão", `${alvo.codigo} — ${alvo.titulo}`)
        ),
      };
    }
    case "missao/status": {
      const alvo = state.missoes.find((m) => m.id === action.payload.id);
      if (!alvo || alvo.status === action.payload.status) return state;
      const agora = new Date().toISOString();
      return {
        ...state,
        missoes: state.missoes.map((m) =>
          m.id === action.payload.id
            ? {
                ...m,
                status: action.payload.status,
                atualizadoEm: agora,
                historico: [
                  ...m.historico,
                  {
                    id: genId("hi"),
                    status: action.payload.status,
                    descricao: action.payload.descricao ?? "Status alterado manualmente",
                    timestamp: agora,
                  },
                ],
              }
            : m
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "missao",
            "alterou o status da missão",
            alvo.codigo,
            action.payload.descricao
          )
        ),
      };
    }
    case "missao/evidencia/adicionar": {
      const alvo = state.missoes.find((m) => m.id === action.payload.id);
      if (!alvo) return state;
      const evidencia: MissionEvidence = {
        ...action.payload.evidencia,
        id: genId("ev"),
        timestamp: new Date().toISOString(),
      };
      return {
        ...state,
        missoes: state.missoes.map((m) =>
          m.id === action.payload.id
            ? { ...m, evidencias: [evidencia, ...m.evidencias], atualizadoEm: evidencia.timestamp }
            : m
        ),
        atividades: withActivity(
          state,
          makeActivity("missao", "registrou evidência em", alvo.codigo, evidencia.descricao)
        ),
      };
    }
    case "missao/evidencia/remover": {
      const alvo = state.missoes.find((m) => m.id === action.payload.id);
      if (!alvo) return state;
      return {
        ...state,
        missoes: state.missoes.map((m) =>
          m.id === action.payload.id
            ? { ...m, evidencias: m.evidencias.filter((ev) => ev.id !== action.payload.evidenciaId) }
            : m
        ),
        atividades: withActivity(
          state,
          makeActivity("missao", "removeu evidência de", alvo.codigo)
        ),
      };
    }

    /* -------------------------------------------------- integrações */
    case "integracao/solicitar": {
      // Nunca marca como "ativa": apenas registra a intenção de autorização.
      const alvo = state.integracoes.find((i) => i.id === action.payload.id);
      if (!alvo || alvo.estado === "aguardando_autorizacao") return state;
      return {
        ...state,
        integracoes: state.integracoes.map((i) =>
          i.id === action.payload.id
            ? { ...i, estado: "aguardando_autorizacao", ultimaVerificacao: null }
            : i
        ),
        atividades: withActivity(
          state,
          makeActivity(
            "integracao",
            "solicitou autorização para",
            alvo.nome,
            "Permanece desativada até comprovação de acesso real"
          )
        ),
      };
    }
    case "integracao/desativar": {
      const alvo = state.integracoes.find((i) => i.id === action.payload.id);
      if (!alvo || alvo.estado === "desativada") return state;
      return {
        ...state,
        integracoes: state.integracoes.map((i) =>
          i.id === action.payload.id ? { ...i, estado: "desativada", ultimaVerificacao: null } : i
        ),
        atividades: withActivity(
          state,
          makeActivity("integracao", "desativou", alvo.nome)
        ),
      };
    }

    /* -------------------------------------------------- execuções */
    case "execucao/registrar": {
      return {
        ...state,
        execucoes: [action.payload, ...state.execucoes].slice(0, 100),
        atividades: withActivity(
          state,
          makeActivity(
            "execucao",
            "executou localmente",
            action.payload.missaoId
              ? state.missoes.find((m) => m.id === action.payload.missaoId)?.codigo ?? "tarefa"
              : "tarefa de demonstração",
            action.payload.verificacao.passou
              ? "Verificação local aprovada"
              : "Verificação local com divergência"
          )
        ),
      };
    }

    /* -------------------------------------------------- estado */
    case "estado/importar": {
      // O estado já chega validado/normalizado por parseStoredState.
      return {
        ...action.payload,
        atividades: [
          makeActivity("backup", "importou backup", "estado restaurado", "Conteúdo validado antes da aplicação"),
          ...action.payload.atividades,
        ].slice(0, MAX_ACTIVITIES),
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
