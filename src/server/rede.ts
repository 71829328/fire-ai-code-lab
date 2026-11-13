// =====================================================================
// FIRE Agent Command Center — LAB-004
// Utilitários de rede server-side (tipo mínimo de fetch, testável).
// =====================================================================

export type Cabecalhos = Record<string, string>;

export interface RespostaMinima {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Cabecalhos; body?: string }
) => Promise<RespostaMinima>;

export const fetchPadrao: FetchLike = (url, init) =>
  (globalThis.fetch as unknown as (u: string, i?: unknown) => Promise<RespostaMinima>)(url, init);

export async function lerJson(resposta: RespostaMinima): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}

export function mensagemErroHttp(dados: unknown, status: number): string {
  if (dados && typeof dados === "object") {
    const registro = dados as Record<string, unknown>;
    if (typeof registro.message === "string") return registro.message;
    if (typeof registro.error === "string") return registro.error;
  }
  return `HTTP ${status}`;
}
