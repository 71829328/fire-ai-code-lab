// Validação integral dos dados armazenados / importados.
//
// Objetivo (auditoria CTO): nunca confiar cegamente no conteúdo do
// localStorage ou de um backup. Este módulo:
//   1. valida campo a campo cada entidade;
//   2. normaliza valores ausentes ou fora de faixa;
//   3. migra o formato anterior (v1, com a flag `demo`) para o atual (v2, com
//      `origem`);
//   4. descarta registros irrecuperáveis e reporta o motivo.
//
// O resultado sempre informa `issues` e quantos registros foram descartados,
// para que a interface possa alertar o usuário em vez de falhar em silêncio.

import {
  APP_STATE_VERSION,
  type Activity,
  type Agent,
  type AppState,
  type Integration,
  type IntegrationProviderId,
  type IntegrationState,
  type LocalExecution,
  type Mission,
  type MissionEvidence,
  type MissionHistoryEntry,
  type Origem,
  type Project,
  type Task,
  AGENT_STATUS_LABEL,
  INTEGRATION_STATE_LABEL,
  MISSION_STATUS_LABEL,
  PRIORITY_LABEL,
  PROJECT_STATUS_LABEL,
  TASK_STATUS_LABEL,
} from "../types";

export interface ValidationIssue {
  caminho: string;
  mensagem: string;
}

export interface ParseResult {
  state: AppState | null;
  issues: ValidationIssue[];
  migrado: boolean;
  descartados: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function asOneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asIso(value: unknown): string {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

function asNumberInRange(value: unknown, min: number, max: number, fallback: number): number {
  const number = asNumber(value, fallback);
  return Math.max(min, Math.min(max, number));
}

// Migra o campo `demo` (v1) para `origem` (v2).
function readOrigem(record: Record<string, unknown>): { origem: Origem; migrado: boolean } {
  if (record.origem === "demonstrativo" || record.origem === "cadastrado") {
    return { origem: record.origem, migrado: false };
  }
  if (record.demo === true) return { origem: "demonstrativo", migrado: true };
  if (record.demo === false) return { origem: "cadastrado", migrado: true };
  return { origem: "cadastrado", migrado: false };
}

const AGENT_STATUS = Object.keys(AGENT_STATUS_LABEL) as Agent["status"][];
const PROJECT_STATUS = Object.keys(PROJECT_STATUS_LABEL) as Project["status"][];
const TASK_STATUS = Object.keys(TASK_STATUS_LABEL) as Task["status"][];
const PRIORITIES = Object.keys(PRIORITY_LABEL) as Project["prioridade"][];
const MISSION_STATUS = Object.keys(MISSION_STATUS_LABEL) as Mission["status"][];
const INTEGRATION_STATE = Object.keys(INTEGRATION_STATE_LABEL) as IntegrationState[];

function parseActivity(raw: unknown, index: number, issues: ValidationIssue[]): Activity | null {
  if (!isRecord(raw)) {
    issues.push({ caminho: `atividades[${index}]`, mensagem: "registro não é um objeto" });
    return null;
  }
  return {
    id: asString(raw.id) || `ac-desconhecido-${index}`,
    tipo: asOneOf(raw.tipo, ["agente", "projeto", "tarefa", "missao", "integracao", "execucao", "sistema", "backup"], "sistema"),
    acao: asString(raw.acao, "atualizou"),
    alvo: asString(raw.alvo, "registro"),
    detalhe: typeof raw.detalhe === "string" ? raw.detalhe : undefined,
    timestamp: asIso(raw.timestamp),
  };
}

function parseAgent(raw: unknown, index: number, issues: ValidationIssue[], ctx: { migrado: boolean }) {
  if (!isRecord(raw)) {
    issues.push({ caminho: `agentes[${index}]`, mensagem: "registro não é um objeto" });
    return null;
  }
  const origem = readOrigem(raw);
  ctx.migrado = ctx.migrado || origem.migrado;
  // A conexão só é "verificada" quando existe uma data de verificação válida.
  // Sem isso, o registro é forçado para "desconectado" — nunca inventamos uma
  // comprovação que não exista.
  const verificado =
    raw.conexao === "verificado" &&
    typeof raw.verificadoEm === "string" &&
    !Number.isNaN(Date.parse(raw.verificadoEm));
  return {
    id: asString(raw.id) || `ag-${index}`,
    nome: asString(raw.nome, "Agente sem nome"),
    papel: asString(raw.papel, "Não informado"),
    status: asOneOf(raw.status, AGENT_STATUS, "inativo"),
    modelo: asString(raw.modelo, "Não informado"),
    proficiencia: asNumberInRange(raw.proficiencia, 0, 100, 0),
    tarefasConcluidas: asNumberInRange(raw.tarefasConcluidas, 0, 1_000_000, 0),
    descricao: asString(raw.descricao),
    origem: origem.origem,
    // Sem comprovação real, a conexão é forçada de volta para "desconectado".
    conexao: verificado ? "verificado" : "desconectado",
    provedorId:
      typeof raw.provedorId === "string"
        ? (raw.provedorId as IntegrationProviderId)
        : null,
    verificadoEm: verificado ? asIso(raw.verificadoEm) : null,
    criadoEm: asIso(raw.criadoEm),
  } satisfies Agent;
}

function parseProject(raw: unknown, index: number, issues: ValidationIssue[], ctx: { migrado: boolean }) {
  if (!isRecord(raw)) {
    issues.push({ caminho: `projetos[${index}]`, mensagem: "registro não é um objeto" });
    return null;
  }
  const origem = readOrigem(raw);
  ctx.migrado = ctx.migrado || origem.migrado;
  return {
    id: asString(raw.id) || `pr-${index}`,
    nome: asString(raw.nome, "Projeto sem nome"),
    descricao: asString(raw.descricao),
    status: asOneOf(raw.status, PROJECT_STATUS, "planejado"),
    responsavelId: typeof raw.responsavelId === "string" ? raw.responsavelId : null,
    progresso: asNumberInRange(raw.progresso, 0, 100, 0),
    prioridade: asOneOf(raw.prioridade, PRIORITIES, "media"),
    prazo: asIso(raw.prazo),
    criadoEm: asIso(raw.criadoEm),
    origem: origem.origem,
  } satisfies Project;
}

function parseTask(raw: unknown, index: number, issues: ValidationIssue[], ctx: { migrado: boolean }) {
  if (!isRecord(raw)) {
    issues.push({ caminho: `tarefas[${index}]`, mensagem: "registro não é um objeto" });
    return null;
  }
  const origem = readOrigem(raw);
  ctx.migrado = ctx.migrado || origem.migrado;
  return {
    id: asString(raw.id) || `tk-${index}`,
    titulo: asString(raw.titulo, "Tarefa sem título"),
    descricao: asString(raw.descricao),
    status: asOneOf(raw.status, TASK_STATUS, "pendente"),
    prioridade: asOneOf(raw.prioridade, PRIORITIES, "media"),
    projetoId: typeof raw.projetoId === "string" ? raw.projetoId : null,
    agenteId: typeof raw.agenteId === "string" ? raw.agenteId : null,
    ordem: asNumber(raw.ordem, index),
    criadoEm: asIso(raw.criadoEm),
    origem: origem.origem,
  } satisfies Task;
}

function parseEvidence(raw: unknown, index: number): MissionEvidence | null {
  if (!isRecord(raw)) return null;
  return {
    id: asString(raw.id) || `ev-${index}`,
    tipo: asOneOf(raw.tipo, ["evidencia", "commit", "resultado", "relatorio"], "evidencia"),
    descricao: asString(raw.descricao, "Sem descrição"),
    valor: asString(raw.valor),
    autor: asOneOf(raw.autor, ["usuario", "executor_local", "importado"], "usuario"),
    timestamp: asIso(raw.timestamp),
  };
}

function parseHistory(raw: unknown, index: number): MissionHistoryEntry | null {
  if (!isRecord(raw)) return null;
  return {
    id: asString(raw.id) || `hi-${index}`,
    status: asOneOf(raw.status, MISSION_STATUS, "pendente"),
    descricao: asString(raw.descricao, "Atualização de status"),
    timestamp: asIso(raw.timestamp),
  };
}

function parseMission(raw: unknown, index: number, issues: ValidationIssue[], ctx: { migrado: boolean }) {
  if (!isRecord(raw)) {
    issues.push({ caminho: `missoes[${index}]`, mensagem: "registro não é um objeto" });
    return null;
  }
  const origem = readOrigem(raw);
  ctx.migrado = ctx.migrado || origem.migrado;
  const codigo = asString(raw.codigo);
  if (!codigo.trim()) {
    issues.push({
      caminho: `missoes[${index}]`,
      mensagem: "identificador único ausente — registro descartado",
    });
    return null;
  }
  return {
    id: asString(raw.id) || `ms-${index}`,
    codigo,
    titulo: asString(raw.titulo, "Missão sem título"),
    objetivo: asString(raw.objetivo),
    instrucoes: asString(raw.instrucoes),
    prioridade: asOneOf(raw.prioridade, PRIORITIES, "media"),
    criteriosAceite: asArray(raw.criteriosAceite)
      .filter((item): item is string => typeof item === "string")
      .filter((item) => item.trim().length > 0),
    agenteId: typeof raw.agenteId === "string" ? raw.agenteId : null,
    projetoId: typeof raw.projetoId === "string" ? raw.projetoId : null,
    dependencias: asArray(raw.dependencias).filter(
      (item): item is string => typeof item === "string"
    ),
    status: asOneOf(raw.status, MISSION_STATUS, "pendente"),
    origem: origem.origem,
    evidencias: asArray(raw.evidencias).map(parseEvidence).filter((item): item is MissionEvidence => item !== null),
    historico: asArray(raw.historico).map(parseHistory).filter((item): item is MissionHistoryEntry => item !== null),
    criadoEm: asIso(raw.criadoEm),
    atualizadoEm: asIso(raw.atualizadoEm),
  } satisfies Mission;
}

function parseIntegration(raw: unknown): Integration | null {
  if (!isRecord(raw)) return null;
  const estado = asOneOf(raw.estado, INTEGRATION_STATE, "desativada");
  const estadoSeguro: IntegrationState = estado === "ativa" && raw.ultimaVerificacao == null ? "desativada" : estado;
  return {
    id: asOneOf(raw.id, ["chatgpt", "codex", "work", "trae", "manus"], "trae"),
    nome: asString(raw.nome, "Integração"),
    descricao: asString(raw.descricao),
    estado: estadoSeguro,
    requer: asString(raw.requer),
    capacidades: asArray(raw.capacidades).filter((item): item is string => typeof item === "string"),
    ultimaVerificacao:
      typeof raw.ultimaVerificacao === "string" ? asIso(raw.ultimaVerificacao) : null,
    origem: readOrigem(raw).origem,
  };
}

function parseExecution(raw: unknown, index: number): LocalExecution | null {
  if (!isRecord(raw)) return null;
  const saida = isRecord(raw.saida) ? raw.saida : {};
  const verificacao = isRecord(raw.verificacao) ? raw.verificacao : {};
  return {
    id: asString(raw.id) || `ex-${index}`,
    missaoId: typeof raw.missaoId === "string" ? raw.missaoId : null,
    entrada: asString(raw.entrada),
    saida: {
      caracteres: asNumber(saida.caracteres),
      palavras: asNumber(saida.palavras),
      linhas: asNumber(saida.linhas),
      resumo: asString(saida.resumo),
    },
    checksum: asString(raw.checksum),
    verificacao: {
      passou: verificacao.passou === true,
      detalhe: asString(verificacao.detalhe),
    },
    duracaoMs: asNumber(raw.duracaoMs),
    timestamp: asIso(raw.timestamp),
    modo: "local",
  };
}

// Valida e normaliza um estado completo (vindo do localStorage ou de um backup).
export function parseStoredState(raw: unknown): ParseResult {
  const issues: ValidationIssue[] = [];
  const ctx = { migrado: false };

  if (!isRecord(raw)) {
    return {
      state: null,
      issues: [{ caminho: "raiz", mensagem: "conteúdo não é um objeto de estado" }],
      migrado: false,
      descartados: 0,
    };
  }

  const arrays = ["agentes", "projetos", "tarefas", "atividades"];
  const faltando = arrays.filter((key) => !Array.isArray(raw[key]));
  if (faltando.length > 0) {
    issues.push({
      caminho: "raiz",
      mensagem: `coleções obrigatórias ausentes ou inválidas: ${faltando.join(", ")}`,
    });
    return { state: null, issues, migrado: false, descartados: 0 };
  }

  let descartados = 0;
  const comDescartes = <T,>(items: (T | null)[]): T[] => {
    const validos = items.filter((item): item is T => item !== null);
    descartados += items.length - validos.length;
    return validos;
  };

  const state: AppState = {
    versao: APP_STATE_VERSION,
    agentes: comDescartes(asArray(raw.agentes).map((item, i) => parseAgent(item, i, issues, ctx))),
    projetos: comDescartes(asArray(raw.projetos).map((item, i) => parseProject(item, i, issues, ctx))),
    tarefas: comDescartes(asArray(raw.tarefas).map((item, i) => parseTask(item, i, issues, ctx))),
    missoes: comDescartes(asArray(raw.missoes).map((item, i) => parseMission(item, i, issues, ctx))),
    integracoes: comDescartes(asArray(raw.integracoes).map(parseIntegration)),
    execucoes: comDescartes(asArray(raw.execucoes).map(parseExecution)),
    atividades: comDescartes(asArray(raw.atividades).map((item, i) => parseActivity(item, i, issues))),
  };

  return { state, issues, migrado: ctx.migrado, descartados };
}
