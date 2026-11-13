// Camada de persistência desacoplada do núcleo operacional.
//
// Estratégia: um "port" (RepositoryPort) com três implementações:
//   - MemoryRepository  → em memória (testes);
//   - LocalRepository   → localStorage (comportamento atual da aplicação);
//   - SupabaseRepository → preparado, porém DESATIVADO até existir projeto e
//     credenciais autorizados. Não inventa endpoints nem faz chamadas.
//
// O estado é validado antes de ser aplicado, reutilizando as mesmas garantias da
// camada demonstrativa.

import {
  PLATFORM_STATE_VERSION,
  type Aprovacao,
  type AuditEntry,
  type EvidenceRecord,
  type Organizacao,
  type OrigemDado,
  type PlatformState,
  type Usuario,
  type UsageMetric,
} from "./types";
import { listarMigracoes } from "./migrations";

export interface PersistIssue {
  caminho: string;
  mensagem: string;
}

export interface PlatformParseResult {
  state: PlatformState | null;
  issues: PersistIssue[];
  descartados: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const asString = (v: unknown, fb = ""): string => (typeof v === "string" ? v : fb);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asIso = (v: unknown): string => {
  if (typeof v === "string" && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return new Date().toISOString();
};
const asNum = (v: unknown, fb = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fb;
const asBool = (v: unknown): boolean => v === true;

const PAPEIS = ["proprietario", "administrador", "operador", "revisor", "observador"] as const;
const AMBIENTES = ["demonstracao", "homologacao", "producao"] as const;
const ORIGENS_DADO = ["informado_agente", "informado_operador", "verificado_independente"] as const;
const KINDS = [
  "repositorio",
  "branch",
  "commit",
  "pull_request",
  "deployment",
  "teste",
  "captura",
  "relatorio",
  "arquivo",
  "bloqueio",
] as const;
const DECISOES = ["pendente", "aprovado", "rejeitado"] as const;
const CRITICIDADES = ["normal", "critica"] as const;
const RESULTADOS = ["permitido", "negado", "info"] as const;

function oneOf<T extends readonly string[]>(v: unknown, allowed: T, fb: T[number]): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T[number])
    : fb;
}

function parseOrganizacao(raw: unknown, i: number): Organizacao | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    nome: asString(raw.nome, `Organização ${i + 1}`),
    criadoEm: asIso(raw.criadoEm),
    ambiente: oneOf(raw.ambiente, AMBIENTES, "demonstracao"),
  };
}

function parseUsuario(raw: unknown, i: number): Usuario | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const organizacaoId = asString(raw.organizacaoId);
  if (!id || !organizacaoId) return null;
  return {
    id,
    organizacaoId,
    nome: asString(raw.nome, `Usuário ${i + 1}`),
    email: asString(raw.email),
    papel: oneOf(raw.papel, PAPEIS, "observador"),
    ativo: raw.ativo === undefined ? true : asBool(raw.ativo),
    criadoEm: asIso(raw.criadoEm),
  };
}

function parseAprovacao(raw: unknown): Aprovacao | null {
  if (!isRecord(raw)) return null;
  if (!asString(raw.id) || !asString(raw.missaoId)) return null;
  return {
    id: asString(raw.id),
    organizacaoId: asString(raw.organizacaoId),
    missaoId: asString(raw.missaoId),
    runId: typeof raw.runId === "string" ? raw.runId : null,
    criticidade: oneOf(raw.criticidade, CRITICIDADES, "normal"),
    decisao: oneOf(raw.decisao, DECISOES, "pendente"),
    solicitadoPor: typeof raw.solicitadoPor === "string" ? raw.solicitadoPor : null,
    decididoPor: typeof raw.decididoPor === "string" ? raw.decididoPor : null,
    justificativa: asString(raw.justificativa),
    solicitadoEm: asIso(raw.solicitadoEm),
    decididoEm: typeof raw.decididoEm === "string" ? asIso(raw.decididoEm) : null,
  };
}

function parseAuditoria(raw: unknown): AuditEntry | null {
  if (!isRecord(raw)) return null;
  if (!asString(raw.id)) return null;
  return {
    id: asString(raw.id),
    organizacaoId: asString(raw.organizacaoId),
    usuarioId: typeof raw.usuarioId === "string" ? raw.usuarioId : null,
    acao: asString(raw.acao, "ação"),
    recurso: asString(raw.recurso, "recurso"),
    recursoId: typeof raw.recursoId === "string" ? raw.recursoId : null,
    resultado: oneOf(raw.resultado, RESULTADOS, "info"),
    detalhe: typeof raw.detalhe === "string" ? raw.detalhe : undefined,
    timestamp: asIso(raw.timestamp),
  };
}

function parseConsumo(raw: unknown): UsageMetric | null {
  if (!isRecord(raw)) return null;
  if (!asString(raw.id)) return null;
  return {
    id: asString(raw.id),
    organizacaoId: asString(raw.organizacaoId),
    provedorId: asString(raw.provedorId, "desconhecido"),
    agenteId: typeof raw.agenteId === "string" ? raw.agenteId : null,
    missaoId: typeof raw.missaoId === "string" ? raw.missaoId : null,
    runId: typeof raw.runId === "string" ? raw.runId : null,
    unidade: asString(raw.unidade, "unidades"),
    quantidade: asNum(raw.quantidade),
    custoEstimado: asNum(raw.custoEstimado),
    moeda: asString(raw.moeda, "BRL"),
    origemDado: oneOf(raw.origemDado, ORIGENS_DADO, "informado_operador"),
    timestamp: asIso(raw.timestamp),
  };
}

function parseEvidencia(raw: unknown): EvidenceRecord | null {
  if (!isRecord(raw)) return null;
  const referencia = asString(raw.referencia);
  if (!asString(raw.id) || !referencia.trim()) return null;
  const origemDado: OrigemDado = oneOf(raw.origemDado, ORIGENS_DADO, "informado_operador");
  // Coerência: só "verificado_independente" pode ter verificadoEm/verificadoPor.
  const verificado = origemDado === "verificado_independente";
  return {
    id: asString(raw.id),
    organizacaoId: asString(raw.organizacaoId),
    missaoId: typeof raw.missaoId === "string" ? raw.missaoId : null,
    runId: typeof raw.runId === "string" ? raw.runId : null,
    tipo: oneOf(raw.tipo, KINDS, "relatorio"),
    referencia,
    descricao: asString(raw.descricao),
    valor: asString(raw.valor),
    origemDado,
    registradoPor: typeof raw.registradoPor === "string" ? raw.registradoPor : null,
    verificadoPor: verificado && typeof raw.verificadoPor === "string" ? raw.verificadoPor : null,
    verificadoEm: verificado && typeof raw.verificadoEm === "string" ? asIso(raw.verificadoEm) : null,
    timestamp: asIso(raw.timestamp),
  };
}

export function parsePlatformState(raw: unknown): PlatformParseResult {
  const issues: PersistIssue[] = [];
  if (!isRecord(raw)) {
    return { state: null, issues: [{ caminho: "raiz", mensagem: "conteúdo não é um objeto" }], descartados: 0 };
  }
  const obrigatorias = ["organizacoes", "usuarios"];
  const faltando = obrigatorias.filter((k) => !Array.isArray(raw[k]));
  if (faltando.length > 0) {
    return {
      state: null,
      issues: [{ caminho: "raiz", mensagem: `coleções obrigatórias ausentes: ${faltando.join(", ")}` }],
      descartados: 0,
    };
  }

  let descartados = 0;
  const limpar = <T,>(itens: (T | null)[]): T[] => {
    const validos = itens.filter((x): x is T => x !== null);
    descartados += itens.length - validos.length;
    return validos;
  };

  const organizacoes = limpar(asArray(raw.organizacoes).map(parseOrganizacao));
  const usuarios = limpar(asArray(raw.usuarios).map(parseUsuario));
  if (organizacoes.length === 0) {
    issues.push({ caminho: "organizacoes", mensagem: "nenhuma organização válida encontrada" });
  }

  const state: PlatformState = {
    versao: PLATFORM_STATE_VERSION,
    organizacaoAtivaId: asString(raw.organizacaoAtivaId, organizacoes[0]?.id ?? ""),
    organizacoes,
    usuarios,
    usuarioAtivoId: asString(raw.usuarioAtivoId, usuarios[0]?.id ?? ""),
    aprovacoes: limpar(asArray(raw.aprovacoes).map(parseAprovacao)),
    auditoria: limpar(asArray(raw.auditoria).map(parseAuditoria)),
    consumo: limpar(asArray(raw.consumo).map(parseConsumo)),
    evidencias: limpar(asArray(raw.evidencias).map(parseEvidencia)),
    // Migrações são sempre relidas do código-fonte (fonte única de verdade).
    migracoes: listarMigracoes(),
  };

  // Garante que a organização/usuário ativos existam de fato.
  if (!state.organizacoes.some((o) => o.id === state.organizacaoAtivaId)) {
    state.organizacaoAtivaId = state.organizacoes[0]?.id ?? "";
  }
  if (!state.usuarios.some((u) => u.id === state.usuarioAtivoId && u.organizacaoId === state.organizacaoAtivaId)) {
    state.usuarioAtivoId =
      state.usuarios.find((u) => u.organizacaoId === state.organizacaoAtivaId)?.id ?? "";
  }

  return { state, issues, descartados };
}

/* ------------------------------------------------------------------ */
/* Porta de repositório e implementações                               */
/* ------------------------------------------------------------------ */

export interface RepoLoad {
  state: PlatformState | null;
  aviso: string | null;
}

export interface RepositoryPort {
  nome: "memoria" | "local" | "supabase";
  disponivel: boolean;
  disponivelMotivo: string;
  carregar(): Promise<RepoLoad>;
  salvar(state: PlatformState): Promise<{ ok: boolean; mensagem: string }>;
}

export class MemoryRepository implements RepositoryPort {
  nome = "memoria" as const;
  disponivel = true;
  disponivelMotivo = "Repositório em memória (testes).";
  private dados: PlatformState | null = null;
  async carregar(): Promise<RepoLoad> {
    return { state: this.dados, aviso: null };
  }
  async salvar(state: PlatformState) {
    this.dados = state;
    return { ok: true, mensagem: "Estado mantido em memória." };
  }
}

export const PLATFORM_STORAGE_KEY = "fire-agent-command-center:platform:v1";

export class LocalRepository implements RepositoryPort {
  nome = "local" as const;
  disponivel: boolean;
  disponivelMotivo: string;

  constructor() {
    this.disponivel = typeof window !== "undefined" && !!window.localStorage;
    this.disponivelMotivo = this.disponivel
      ? "Persistência no navegador (localStorage)."
      : "localStorage indisponível neste ambiente.";
  }

  async carregar(): Promise<RepoLoad> {
    if (!this.disponivel || typeof window === "undefined") return { state: null, aviso: null };
    const raw = window.localStorage.getItem(PLATFORM_STORAGE_KEY);
    if (!raw) return { state: null, aviso: null };
    try {
      return carregarDeTexto(raw);
    } catch {
      return { state: null, aviso: "Conteúdo do núcleo operacional ilegível; recomeçando do estado inicial." };
    }
  }

  async salvar(state: PlatformState) {
    if (!this.disponivel || typeof window === "undefined") {
      return { ok: false, mensagem: "localStorage indisponível." };
    }
    try {
      window.localStorage.setItem(PLATFORM_STORAGE_KEY, JSON.stringify(state));
      return { ok: true, mensagem: "Núcleo operacional salvo neste navegador." };
    } catch {
      return { ok: false, mensagem: "Falha ao salvar o núcleo operacional (armazenamento cheio ou bloqueado)." };
    }
  }
}

// Supabase: preparado, mas DESATIVADO. Não há projeto/credencial autorizados.
export class SupabaseRepository implements RepositoryPort {
  nome = "supabase" as const;
  disponivel = false;
  disponivelMotivo =
    "Supabase não configurado: exige projeto autorizado e credenciais fornecidas pelo proprietário (nunca no frontend).";
  async carregar(): Promise<RepoLoad> {
    return { state: null, aviso: this.disponivelMotivo };
  }
  async salvar() {
    return { ok: false, mensagem: this.disponivelMotivo };
  }
}

function carregarDeTexto(raw: string): RepoLoad {
  const parsed = JSON.parse(raw) as unknown;
  const resultado = parsePlatformState(parsed);
  if (!resultado.state) {
    return { state: null, aviso: "Estado do núcleo operacional inválido; recomeçando do inicial." };
  }
  const aviso =
    resultado.descartados > 0 ? `${resultado.descartados} registro(s) inválido(s) descartado(s) ao carregar.` : null;
  return { state: resultado.state, aviso };
}

export function criarRepositorio(modo: "memoria" | "local" | "supabase"): RepositoryPort {
  switch (modo) {
    case "memoria":
      return new MemoryRepository();
    case "supabase":
      return new SupabaseRepository();
    case "local":
    default:
      return new LocalRepository();
  }
}

/* ------------------------------------------------------------------ */
/* Carga/gravação síncrona do estado operacional (OpsState)            */
/* ------------------------------------------------------------------ */

import type { MissionRun } from "../orchestration/types";
import type { OpsState } from "./ops";

export const OPS_STORAGE_KEY = "fire-agent-command-center:ops:v1";

function parseRun(raw: unknown, _i: number): MissionRun | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const missaoId = asString(raw.missaoId);
  if (!id || !missaoId) return null;
  const tentativas = asArray(raw.tentativas).map((t, j) => {
    const att = isRecord(t) ? t : {};
    return {
      numero: asNum(att.numero, j + 1),
      inicio: asIso(att.inicio),
      fim: typeof att.fim === "string" ? asIso(att.fim) : null,
      status: oneOf(att.status, ["executando", "sucesso", "falha", "timeout"] as const, "executando"),
      erro: typeof att.erro === "string" ? att.erro : null,
      resultado: null,
    };
  });
  return {
    id,
    organizacaoId: asString(raw.organizacaoId),
    missaoId,
    missaoCodigo: asString(raw.missaoCodigo, "MSN-0000"),
    agenteId: typeof raw.agenteId === "string" ? raw.agenteId : null,
    prioridade: oneOf(raw.prioridade, ["baixa", "media", "alta"] as const, "media"),
    criticidade: oneOf(raw.criticidade, ["normal", "critica"] as const, "normal"),
    status: oneOf(
      raw.status,
      ["enfileirada", "aguardando_dependencia", "aguardando_aprovacao", "executando", "concluida", "falhou", "cancelada", "expirada"] as const,
      "enfileirada"
    ),
    chaveIdempotencia: asString(raw.chaveIdempotencia, id),
    tentativaAtual: asNum(raw.tentativaAtual),
    tentativas,
    eventos: asArray(raw.eventos).map((e, j) => {
      const ev = isRecord(e) ? e : {};
      return {
        id: asString(ev.id, `ev-${j}`),
        status: oneOf(
          ev.status,
          ["enfileirada", "aguardando_dependencia", "aguardando_aprovacao", "executando", "concluida", "falhou", "cancelada", "expirada"] as const,
          "enfileirada"
        ),
        descricao: asString(ev.descricao),
        timestamp: asIso(ev.timestamp),
      };
    }),
    criadoEm: asIso(raw.criadoEm),
    atualizadoEm: asIso(raw.atualizadoEm),
    iniciadoEm: typeof raw.iniciadoEm === "string" ? asIso(raw.iniciadoEm) : null,
    finalizadoEm: typeof raw.finalizadoEm === "string" ? asIso(raw.finalizadoEm) : null,
    resultado: null,
    erro: typeof raw.erro === "string" ? raw.erro : null,
  };
}

export function parseOpsState(raw: unknown): { state: OpsState | null; aviso: string | null } {
  if (!isRecord(raw)) return { state: null, aviso: "Conteúdo inválido." };
  const plataforma = parsePlatformState(raw.platform);
  if (!plataforma.state) return { state: null, aviso: "Núcleo operacional inválido." };
  let descartados = plataforma.descartados;
  const runsBrutos = asArray(raw.runs);
  const runs = runsBrutos.map(parseRun).filter((r): r is MissionRun => r !== null);
  descartados += runsBrutos.length - runs.length;
  const aviso = descartados > 0 ? `${descartados} registro(s) inválido(s) descartado(s) ao carregar.` : null;
  return { state: { platform: plataforma.state, runs }, aviso };
}

export function carregarOpsLocal(): { state: OpsState | null; aviso: string | null } {
  if (typeof window === "undefined") return { state: null, aviso: null };
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(OPS_STORAGE_KEY);
  } catch {
    return { state: null, aviso: "Falha ao ler o armazenamento local do núcleo operacional." };
  }
  if (!raw) return { state: null, aviso: null };
  try {
    return parseOpsState(JSON.parse(raw) as unknown);
  } catch {
    return { state: null, aviso: "Conteúdo do núcleo operacional ilegível; recomeçando do estado inicial." };
  }
}

export function salvarOpsLocal(state: OpsState): { ok: boolean; mensagem: string } {
  if (typeof window === "undefined") return { ok: true, mensagem: "Ambiente sem armazenamento." };
  try {
    window.localStorage.setItem(OPS_STORAGE_KEY, JSON.stringify(state));
    return { ok: true, mensagem: "Núcleo operacional salvo neste navegador." };
  } catch {
    return { ok: false, mensagem: "Falha ao salvar o núcleo operacional (armazenamento cheio ou bloqueado)." };
  }
}
