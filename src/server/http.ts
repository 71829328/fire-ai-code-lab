// =====================================================================
// FIRE Agent Command Center — LAB-004
// Camada server-side: tipos e utilitários HTTP (framework-agnósticos).
//
// Toda a lógica de servidor vive em src/server/. Os arquivos em api/ são
// apenas adaptadores finos (Vercel) que convertem para ApiRequest/ApiResponse.
// Isso mantém o backend testável sem subir um servidor.
// =====================================================================

export interface ApiRequest {
  method: string;
  /** Caminho relativo à base /api, ex.: "/missions". */
  path: string;
  query: Record<string, string>;
  /** Cabeçalhos com nomes em minúsculas. */
  headers: Record<string, string>;
  body: unknown;
  /** IP de origem (para rate limiting). */
  ip: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export function json(status: number, body: unknown, headers?: Record<string, string>): ApiResponse {
  return {
    status,
    body,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) },
  };
}

export type CodigoErro =
  | "requisicao_invalida"
  | "nao_autenticado"
  | "sessao_invalida"
  | "sem_permissao"
  | "nao_encontrado"
  | "metodo_nao_permitido"
  | "limite_excedido"
  | "indisponivel"
  | "conflito"
  | "erro_interno";

const STATUS_POR_CODIGO: Record<CodigoErro, number> = {
  requisicao_invalida: 400,
  nao_autenticado: 401,
  sessao_invalida: 401,
  sem_permissao: 403,
  nao_encontrado: 404,
  metodo_nao_permitido: 405,
  limite_excedido: 429,
  indisponivel: 503,
  conflito: 409,
  erro_interno: 500,
};

export interface ErroApi {
  erro: CodigoErro;
  mensagem: string;
  detalhes?: unknown;
}

/** Erro controlado. Nunca deve carregar segredos na mensagem. */
export class ApiError extends Error {
  readonly codigo: CodigoErro;
  readonly detalhes?: unknown;

  constructor(codigo: CodigoErro, mensagem: string, detalhes?: unknown) {
    super(mensagem);
    this.name = "ApiError";
    this.codigo = codigo;
    this.detalhes = detalhes;
  }

  toResponse(): ApiResponse {
    const body: ErroApi = { erro: this.codigo, mensagem: this.message };
    if (this.detalhes !== undefined) body.detalhes = this.detalhes;
    return json(STATUS_POR_CODIGO[this.codigo], body);
  }
}

export function normalizarHeaders(raw: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
  }
  return out;
}

export function lerBearer(headers: Record<string, string>): string | null {
  const auth = headers["authorization"];
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1].trim() : null;
}

/** Corpo como objeto simples; rejeita arrays, null e primitivos. */
export function corpoObjeto(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("requisicao_invalida", "O corpo da requisição deve ser um objeto JSON.");
  }
  return body as Record<string, unknown>;
}

export function textoObrigatorio(
  obj: Record<string, unknown>,
  campo: string,
  max = 2000
): string {
  const valor = obj[campo];
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" é obrigatório.`);
  }
  if (valor.length > max) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" excede ${max} caracteres.`);
  }
  return valor.trim();
}

/**
 * Erro de servidor seguro: devolve mensagem genérica, mas registra a causa
 * internamente sem expor stack/DETALHES ao cliente.
 */
export function respostaErroInterno(): ApiResponse {
  return json(500, {
    erro: "erro_interno",
    mensagem: "Erro interno do servidor. A operação não foi concluída.",
  } satisfies ErroApi);
}
