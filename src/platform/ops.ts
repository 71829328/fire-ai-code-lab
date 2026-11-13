// Estado operacional (núcleo LAB-003): plataforma + execuções do motor.
//
// Reúne organizações/usuários/aprovações/auditoria/consumo/evidências (platform)
// com as execuções de missão produzidas pelo motor de orquestração.
//
// Toda mutação relevante gera um registro de auditoria.

import type { MissionRun, RunResultado } from "../orchestration/types";
import {
  cancelar as cancelarRun,
  concluir as concluirRun,
  enfileirar,
  falhar as falharRun,
  processar,
  resolverAprovacao,
  type CriarRunParams,
  criarRun,
} from "../orchestration/engine";
import { missionParaView } from "../orchestration/engine";
import type { Mission } from "../types";
import {
  criarEvidenceRecord,
  verificarIndependente,
} from "../evidence/center";
import {
  PLATFORM_STATE_VERSION,
  type Aprovacao,
  type AuditEntry,
  type EvidenceRecord,
  type Organizacao,
  type Permissao,
  type PlatformState,
  type Usuario,
  type UsageMetric,
} from "./types";
import { autorizar } from "./authz";
import { criarRepositorioSeed } from "./seed";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "../orchestration/types";

let contador = 0;
function novoId(prefixo: string): string {
  contador += 1;
  const r =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefixo}-${r}-${contador}`;
}

export interface OpsState {
  platform: PlatformState;
  runs: MissionRun[];
}

export function createOpsSeed(): OpsState {
  return { platform: criarRepositorioSeed(), runs: [] };
}

export function usuarioAtivo(state: OpsState): Usuario | null {
  return state.platform.usuarios.find((u) => u.id === state.platform.usuarioAtivoId) ?? null;
}

export function podeFazer(state: OpsState, permissao: Permissao): boolean {
  const usuario = usuarioAtivo(state);
  return autorizar(usuario, permissao, state.platform.organizacaoAtivaId).permitido;
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

const MAX_AUDITORIA = 500;

function auditar(
  state: OpsState,
  acao: string,
  recurso: string,
  recursoId: string | null,
  resultado: AuditEntry["resultado"],
  detalhe?: string
): AuditEntry[] {
  const entrada: AuditEntry = {
    id: novoId("au"),
    organizacaoId: state.platform.organizacaoAtivaId,
    usuarioId: state.platform.usuarioAtivoId || null,
    acao,
    recurso,
    recursoId,
    resultado,
    detalhe,
    timestamp: new Date().toISOString(),
  };
  return [entrada, ...state.platform.auditoria].slice(0, MAX_AUDITORIA);
}

export type OpsAction =
  | { type: "organizacao/ativar"; payload: { id: string } }
  | { type: "usuario/ativar"; payload: { id: string } }
  | { type: "run/enfileirar"; payload: { run: MissionRun; permissao: Permissao } }
  | { type: "run/processar"; payload?: { config?: EngineConfig; agora?: string; missoes: Mission[] } }
  | { type: "run/concluir"; payload: { id: string; resultado: RunResultado } }
  | { type: "run/falhar"; payload: { id: string; erro: string } }
  | { type: "run/cancelar"; payload: { id: string } }
  | { type: "run/aprovar"; payload: { id: string; aprovado: boolean; justificativa?: string } }
  | { type: "aprovacao/solicitar"; payload: { missaoId: string; runId: string | null; criticidade: "normal" | "critica"; justificativa?: string } }
  | { type: "evidencia/adicionar"; payload: Omit<EvidenceRecord, "id" | "organizacaoId" | "timestamp"> }
  | { type: "evidencia/verificar"; payload: { id: string; verificador: string } }
  | { type: "consumo/registrar"; payload: Omit<UsageMetric, "id" | "organizacaoId" | "timestamp"> }
  | { type: "usuario/criar"; payload: Pick<Usuario, "nome" | "email" | "papel"> }
  | { type: "estado/importar"; payload: OpsState }
  | { type: "estado/resetar" };

export function opsReducer(state: OpsState, action: OpsAction): OpsState {
  switch (action.type) {
    case "organizacao/ativar": {
      if (!state.platform.organizacoes.some((o) => o.id === action.payload.id)) return state;
      const platform: PlatformState = {
        ...state.platform,
        organizacaoAtivaId: action.payload.id,
        usuarioAtivoId:
          state.platform.usuarios.find((u) => u.organizacaoId === action.payload.id)?.id ?? "",
      };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "ativou organização", "organizacao", action.payload.id, "info") } };
    }
    case "usuario/ativar": {
      const alvo = state.platform.usuarios.find(
        (u) => u.id === action.payload.id && u.organizacaoId === state.platform.organizacaoAtivaId
      );
      if (!alvo) return state;
      const platform: PlatformState = { ...state.platform, usuarioAtivoId: alvo.id };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "trocou o usuário ativo", "usuario", alvo.id, "info") } };
    }

    case "usuario/criar": {
      const decisao = autorizar(usuarioAtivo(state), "usuario:gerenciar", state.platform.organizacaoAtivaId);
      if (!decisao.permitido) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "criou usuário", "usuario", null, "negado", decisao.motivo) } };
      }
      const usuario: Usuario = {
        id: novoId("us"),
        organizacaoId: state.platform.organizacaoAtivaId,
        nome: action.payload.nome,
        email: action.payload.email,
        papel: action.payload.papel,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      const platform: PlatformState = { ...state.platform, usuarios: [...state.platform.usuarios, usuario] };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "criou usuário", "usuario", usuario.id, "permitido", usuario.nome) } };
    }

    case "run/enfileirar": {
      const decisao = autorizar(usuarioAtivo(state), action.payload.permissao, state.platform.organizacaoAtivaId);
      if (!decisao.permitido) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "enfileirou execução", "run", null, "negado", decisao.motivo) } };
      }
      const resultado = enfileirar(state.runs, action.payload.run);
      if (!resultado.criado) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "enfileirou execução", "run", resultado.existenteId, "info", "Ignorado por idempotência") } };
      }
      const base: OpsState = { ...state, runs: resultado.runs };
      return { ...base, platform: { ...base.platform, auditoria: auditar(base, "enfileirou execução", "run", action.payload.run.id, "permitido", action.payload.run.missaoCodigo) } };
    }

    case "run/processar": {
      const missoesViews = (action.payload?.missoes ?? []).map(missionParaView);
      const aprovadas = new Set(
        state.platform.aprovacoes.filter((a) => a.decisao === "aprovado" && a.runId).map((a) => a.runId as string)
      );
      const passo = processar({
        runs: state.runs,
        missoes: missoesViews,
        config: action.payload?.config ?? DEFAULT_ENGINE_CONFIG,
        agora: action.payload?.agora,
        aprovadas,
      });
      let platform = state.platform;
      if (passo.mensagens.length > 0) {
        const base: OpsState = { ...state, platform };
        platform = { ...base.platform, auditoria: auditar(base, "processou a fila", "run", null, "info", passo.mensagens.join("; ")) };
      }
      return { ...state, runs: passo.runs, platform };
    }

    case "run/concluir": {
      const runs = state.runs.map((r) => (r.id === action.payload.id ? concluirRun(r, action.payload.resultado, new Date().toISOString()) : r));
      const base: OpsState = { ...state, runs };
      return { ...base, platform: { ...base.platform, auditoria: auditar(base, "concluiu execução", "run", action.payload.id, "permitido") } };
    }

    case "run/falhar": {
      const agora = new Date().toISOString();
      const runs = state.runs.map((r) => (r.id === action.payload.id ? falharRun(r, action.payload.erro, agora) : r));
      const base: OpsState = { ...state, runs };
      return { ...base, platform: { ...base.platform, auditoria: auditar(base, "registrou falha", "run", action.payload.id, "info", action.payload.erro) } };
    }

    case "run/cancelar": {
      const decisao = autorizar(usuarioAtivo(state), "missao:cancelar", state.platform.organizacaoAtivaId);
      const agora = new Date().toISOString();
      const runs = state.runs.map((r) => (r.id === action.payload.id ? cancelarRun(r, agora) : r));
      const base: OpsState = { ...state, runs };
      return { ...base, platform: { ...base.platform, auditoria: auditar(base, "cancelou execução", "run", action.payload.id, decisao.permitido ? "permitido" : "negado", decisao.motivo) } };
    }

    case "run/aprovar": {
      const decisao = autorizar(usuarioAtivo(state), "missao:aprovar", state.platform.organizacaoAtivaId);
      if (!decisao.permitido) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "decidiu aprovação", "run", action.payload.id, "negado", decisao.motivo) } };
      }
      const agora = new Date().toISOString();
      const runs = state.runs.map((r) => (r.id === action.payload.id ? resolverAprovacao(r, action.payload.aprovado, agora, action.payload.justificativa) : r));
      const aprovacoes = state.platform.aprovacoes.map((a) =>
        a.runId === action.payload.id
          ? { ...a, decisao: action.payload.aprovado ? ("aprovado" as const) : ("rejeitado" as const), decididoPor: state.platform.usuarioAtivoId, decididoEm: agora, justificativa: action.payload.justificativa ?? a.justificativa }
          : a
      );
      const base: OpsState = { ...state, runs, platform: { ...state.platform, aprovacoes } };
      return { ...base, platform: { ...base.platform, auditoria: auditar(base, action.payload.aprovado ? "aprovou execução" : "rejeitou execução", "run", action.payload.id, "permitido") } };
    }

    case "aprovacao/solicitar": {
      const aprovacao: Aprovacao = {
        id: novoId("apv"),
        organizacaoId: state.platform.organizacaoAtivaId,
        missaoId: action.payload.missaoId,
        runId: action.payload.runId,
        criticidade: action.payload.criticidade,
        decisao: "pendente",
        solicitadoPor: state.platform.usuarioAtivoId || null,
        decididoPor: null,
        justificativa: action.payload.justificativa ?? "",
        solicitadoEm: new Date().toISOString(),
        decididoEm: null,
      };
      const platform: PlatformState = { ...state.platform, aprovacoes: [aprovacao, ...state.platform.aprovacoes] };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "solicitou aprovação", "aprovacao", aprovacao.id, "info") } };
    }

    case "evidencia/adicionar": {
      const decisao = autorizar(usuarioAtivo(state), "evidencia:registrar", state.platform.organizacaoAtivaId);
      if (!decisao.permitido) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "registrou evidência", "evidencia", null, "negado", decisao.motivo) } };
      }
      const evidencia = criarEvidenceRecord({
        ...action.payload,
        organizacaoId: state.platform.organizacaoAtivaId,
        registradoPor: state.platform.usuarioAtivoId || null,
      });
      const platform: PlatformState = { ...state.platform, evidencias: [evidencia, ...state.platform.evidencias] };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "registrou evidência", "evidencia", evidencia.id, "permitido", evidencia.referencia) } };
    }

    case "evidencia/verificar": {
      const decisao = autorizar(usuarioAtivo(state), "evidencia:verificar", state.platform.organizacaoAtivaId);
      if (!decisao.permitido) {
        return { ...state, platform: { ...state.platform, auditoria: auditar(state, "verificou evidência", "evidencia", action.payload.id, "negado", decisao.motivo) } };
      }
      const evidencias = state.platform.evidencias.map((e) =>
        e.id === action.payload.id ? verificarIndependente(e, action.payload.verificador) : e
      );
      const platform: PlatformState = { ...state.platform, evidencias };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "verificou evidência", "evidencia", action.payload.id, "permitido") } };
    }

    case "consumo/registrar": {
      const metrica: UsageMetric = {
        ...action.payload,
        id: novoId("usg"),
        organizacaoId: state.platform.organizacaoAtivaId,
        timestamp: new Date().toISOString(),
      };
      const platform: PlatformState = { ...state.platform, consumo: [metrica, ...state.platform.consumo] };
      const base: OpsState = { ...state, platform };
      return { ...base, platform: { ...platform, auditoria: auditar(base, "registrou consumo", "consumo", metrica.id, "info", `${metrica.quantidade} ${metrica.unidade}`) } };
    }

    case "estado/importar":
      return action.payload;

    case "estado/resetar":
      return createOpsSeed();

    default:
      return state;
  }
}

// Cria e enfileira uma execução a partir de uma missão, já registrando auditoria.
export function prepararRunDeMissao(state: OpsState, missao: Mission, criticidade: "normal" | "critica" = "normal"): { run: MissionRun; params: CriarRunParams } {
  const run = criarRun({
    organizacaoId: state.platform.organizacaoAtivaId,
    missao: missionParaView(missao),
    agenteId: missao.agenteId,
    criticidade,
  });
  return { run, params: { organizacaoId: state.platform.organizacaoAtivaId, missao: missionParaView(missao), agenteId: missao.agenteId, criticidade } };
}

export function organizacoesDisponiveis(state: OpsState): Organizacao[] {
  return state.platform.organizacoes;
}

export { PLATFORM_STATE_VERSION };
