// =====================================================================
// FIRE Agent Command Center — LAB-004
// Cliente de API (frontend → backend serverless).
//
// Regras de segurança aplicadas aqui:
//   - O token de sessão vive SOMENTE em memória; jamais em localStorage,
//     sessionStorage, cookie, log ou captura de tela.
//   - O cliente NÃO decide autorização: apenas apresenta o token emitido pelo
//     servidor. Toda decisão de acesso permanece no servidor.
//   - Falha de rede/servidor é reportada explicitamente — nunca mascarada como
//     sucesso nem substituída por dados simulados.
// =====================================================================

import type { EstadoConexoes } from "../server/conexoes";

/* ------------------------------------------------------------------ */
/* Transporte                                                          */
/* ------------------------------------------------------------------ */

export interface RespostaMinima {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface IniciarRequisicao {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export type FetchLike = (url: string, init?: IniciarRequisicao) => Promise<RespostaMinima>;

export type MotivoFalha = "rede" | "http" | "resposta_invalida" | "nao_autenticado" | "rate_limit";

export type Resultado<T> =
  | { ok: true; status: number; dados: T }
  | { ok: false; status: number | null; motivo: MotivoFalha; mensagem: string };

/* ------------------------------------------------------------------ */
/* Formatos das respostas do servidor                                  */
/* ------------------------------------------------------------------ */

export interface UsuarioAutenticado {
  id: string;
  organizacaoId: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  criadoEm: string;
}

export interface SessaoAutenticada {
  token: string;
  expiraEm: number;
  usuario: UsuarioAutenticado;
}

export interface ResumoServidor {
  ambiente: string;
  sessaoConfigurada: boolean;
  supabase: {
    configurado: boolean;
    urlDefinida: boolean;
    chaveAnonDefinida: boolean;
    chaveServicoDefinida: boolean;
  };
  github: { configurado: boolean; repositorioAutorizado: string };
  vercel: { configurado: boolean; projetoAutorizado: string };
}

export interface CapacidadeOAuthCliente {
  provedor: "google" | "microsoft";
  configurado: boolean;
  autorizacaoConectada: boolean;
  observacao: string;
}

export interface RespostaConfig {
  resumo: ResumoServidor;
  conexoes: EstadoConexoes;
  oauth: CapacidadeOAuthCliente[];
}

export interface ResultadoTesteProvedor {
  id: string;
  estado: string;
  ok: boolean;
  mensagem: string;
  detalhe: Record<string, unknown> | null;
}

export interface ResultadoAtivacao {
  id: string;
  ativo: boolean;
  conexoes: EstadoConexoes;
}

export interface EstadoPublicoConexoes {
  ambiente: string;
  geradoEm: string;
  conexoes: EstadoConexoes;
}

/* ------------------------------------------------------------------ */
/* Fábrica do cliente                                                  */
/* ------------------------------------------------------------------ */

/** Armazenamento do token. O padrão é MEMÓRIA — nunca persistente. */
export interface ArmazenamentoToken {
  ler(): string | null;
  gravar(token: string | null): void;
}

export function armazenamentoMemoria(): ArmazenamentoToken {
  let token: string | null = null;
  return {
    ler: () => token,
    gravar: (valor) => {
      token = valor;
    },
  };
}

export interface OpcoesApiCliente {
  /** Base da API. Em produção (Vercel) é "/api". */
  baseUrl?: string;
  fetchImpl?: FetchLike;
  armazenamento?: ArmazenamentoToken;
}

export interface ApiCliente {
  temToken(): boolean;
  definirToken(token: string | null): void;
  limparToken(): void;
  saude(): Promise<Resultado<{ ok: boolean; ambiente: string; hora: string }>>;
  login(email: string, senha: string): Promise<Resultado<SessaoAutenticada>>;
  sessao(): Promise<Resultado<{ autenticado: boolean; usuario: UsuarioAutenticado }>>;
  logout(): Promise<Resultado<{ ok: boolean; mensagem: string }>>;
  config(): Promise<Resultado<RespostaConfig>>;
  integracoes(): Promise<Resultado<EstadoConexoes>>;
  conexoesPublicas(): Promise<Resultado<EstadoPublicoConexoes>>;
  testarProvedor(id: string): Promise<Resultado<ResultadoTesteProvedor>>;
  definirAtivacaoProvedor(id: string, ativo: boolean): Promise<Resultado<ResultadoAtivacao>>;
}

function fetchPadrao(): FetchLike {
  if (typeof fetch !== "function") {
    return () => Promise.reject(new Error("fetch indisponível neste ambiente."));
  }
  return (url, init) => fetch(url, init) as unknown as Promise<RespostaMinima>;
}

function extrairMensagem(dados: unknown, fallback: string): string {
  if (dados !== null && typeof dados === "object") {
    const mensagem = (dados as Record<string, unknown>).mensagem;
    if (typeof mensagem === "string" && mensagem.trim().length > 0) return mensagem;
  }
  return fallback;
}

function normalizarBase(base: string): string {
  const semBarra = base.replace(/\/+$/, "");
  return semBarra.length > 0 ? semBarra : "/api";
}

export function criarApiCliente(opcoes: OpcoesApiCliente = {}): ApiCliente {
  const baseUrl = normalizarBase(opcoes.baseUrl ?? "/api");
  const fetchImpl = opcoes.fetchImpl ?? fetchPadrao();
  const armazenamento = opcoes.armazenamento ?? armazenamentoMemoria();

  async function executar<T>(
    metodo: string,
    caminho: string,
    corpo?: unknown
  ): Promise<Resultado<T>> {
    const token = armazenamento.ler();
    const headers: Record<string, string> = { accept: "application/json" };
    if (corpo !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;

    let resposta: RespostaMinima;
    try {
      resposta = await fetchImpl(`${baseUrl}${caminho}`, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
    } catch {
      return {
        ok: false,
        status: null,
        motivo: "rede",
        mensagem: "Não foi possível alcançar o servidor. Nenhum dado foi presumido.",
      };
    }

    let dados: unknown = null;
    let parseFalhou = false;
    if (resposta.status !== 204) {
      try {
        dados = await resposta.json();
      } catch {
        parseFalhou = true;
      }
    }

    if (!resposta.ok) {
      if (resposta.status === 401) {
        return { ok: false, status: 401, motivo: "nao_autenticado", mensagem: extrairMensagem(dados, "Sessão inválida ou expirada.") };
      }
      if (resposta.status === 429) {
        return { ok: false, status: 429, motivo: "rate_limit", mensagem: extrairMensagem(dados, "Muitas requisições.") };
      }
      return { ok: false, status: resposta.status, motivo: "http", mensagem: extrairMensagem(dados, `Resposta inesperada (${resposta.status}).`) };
    }

    if (parseFalhou) {
      return {
        ok: false,
        status: resposta.status,
        motivo: "resposta_invalida",
        mensagem: "O servidor respondeu em formato inesperado (não é JSON da API). Nenhum dado foi presumido.",
      };
    }

    return { ok: true, status: resposta.status, dados: dados as T };
  }

  return {
    temToken: () => armazenamento.ler() !== null,
    definirToken: (token) => armazenamento.gravar(token),
    limparToken: () => armazenamento.gravar(null),
    saude: () => executar("GET", "/saude"),
    login: async (email, senha) => {
      const resultado = await executar<SessaoAutenticada>("POST", "/auth/login", { email, senha });
      if (resultado.ok && resultado.dados?.token) armazenamento.gravar(resultado.dados.token);
      return resultado;
    },
    sessao: () => executar("GET", "/auth/sessao"),
    logout: () => executar("POST", "/auth/logout", {}),
    config: () => executar("GET", "/config"),
    integracoes: () => executar("GET", "/integracoes"),
    conexoesPublicas: () => executar("GET", "/conexoes/publico"),
    testarProvedor: (id) => executar("POST", "/integracoes/testar", { id }),
    definirAtivacaoProvedor: (id, ativo) => executar("POST", "/integracoes/ativacao", { id, ativo }),
  };
}

/** Cliente padrão da aplicação (token em memória). */
export const api = criarApiCliente();
