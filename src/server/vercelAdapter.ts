// =====================================================================
// FIRE Agent Command Center — LAB-004
// Ponte fina entre o runtime serverless da Vercel e o roteador interno.
//
// O runtime (req/res) é convertido em ApiRequest/ApiResponse. As dependências
// são criadas UMA vez por instância (cold start) e reutilizadas nas requisições
// seguintes, preservando o estado em memória dentro da mesma instância.
// =====================================================================

import { criarDependencias, handleRequest, type DependenciasServidor } from "./router";
import { normalizarHeaders, type ApiRequest } from "./http";

export interface VercelRequestLike {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export interface VercelResponseLike {
  status(code: number): VercelResponseLike;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

let dependencias: DependenciasServidor | null = null;

function obterDependencias(): DependenciasServidor {
  if (!dependencias) dependencias = criarDependencias();
  return dependencias;
}

/** Descarta as dependências em memória (usado por testes). */
export function reiniciarDependencias(): void {
  dependencias = null;
}

function origem(req: VercelRequestLike): string {
  const encaminhado = req.headers["x-forwarded-for"];
  const bruto = Array.isArray(encaminhado) ? encaminhado[0] : encaminhado;
  if (typeof bruto === "string" && bruto.length > 0) return bruto.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "desconhecido";
}

function normalizarQuery(query: VercelRequestLike["query"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(query ?? {})) {
    if (valor === undefined) continue;
    out[chave] = Array.isArray(valor) ? valor[0] : valor;
  }
  return out;
}

/**
 * Resolve o caminho interno. Com a rota fixa informada, usa-a diretamente. Com
 * a sentinela "*", deriva o caminho dos segmentos capturados pela rota dinâmica
 * do Vercel (`api/[...rota].ts`), ex.: ["auth","login"] → "/auth/login".
 */
function resolverCaminho(rota: string, req: VercelRequestLike): string {
  if (rota !== "*") return rota;
  const bruto = req.query?.["rota"];
  const partes = Array.isArray(bruto) ? bruto : typeof bruto === "string" ? bruto.split("/") : [];
  const limpo = partes.filter((p) => p.length > 0);
  return limpo.length > 0 ? `/${limpo.join("/")}` : "/";
}

/**
 * Constrói um handler para uma rota fixa. A rota é o caminho interno (ex.:
 * "/auth/login"), já sem o prefixo "/api". Use `criarHandler()` (rota "*") para
 * um handler catch-all que deriva o caminho da própria requisição.
 */
export function criarHandler(rota: string = "*"): (req: VercelRequestLike, res: VercelResponseLike) => Promise<void> {
  return async (req, res) => {
    const apiRequest: ApiRequest = {
      method: (req.method ?? "GET").toUpperCase(),
      path: resolverCaminho(rota, req),
      query: normalizarQuery(req.query),
      headers: normalizarHeaders(req.headers),
      body: typeof req.body === "string" ? tentarJson(req.body) : req.body ?? {},
      ip: origem(req),
    };
    const resposta = await handleRequest(apiRequest, obterDependencias());
    for (const [nome, valor] of Object.entries(resposta.headers ?? {})) res.setHeader(nome, valor);
    res.status(resposta.status).json(resposta.body);
  };
}

function tentarJson(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return {};
  }
}
