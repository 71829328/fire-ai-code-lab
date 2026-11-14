// =====================================================================
// FIRE Agent Command Center — LAB-004
// Adaptador GitHub (SOMENTE LEITURA), escopo restrito ao repositório autorizado.
//
// Regras:
//   - Usa exclusivamente a API oficial (api.github.com) com token próprio da
//     aplicação, mantido no servidor. NUNCA lê credenciais do ambiente TRAE.
//   - Nenhum acesso a repositórios fora do escopo autorizado: qualquer alvo
//     diferente é recusado ANTES de qualquer chamada de rede.
//   - Somente leitura: nenhum método cria/edita/aprova/mergeia nada.
//   - Sem token, o adaptador está explicitamente DESCONECTADO e todas as
//     operações retornam estado "nao_configurado" — sem chamada de rede.
//   - Nada é declarado "conectado" sem uma chamada real bem-sucedida.
// =====================================================================

import { fetchPadrao, lerJson, mensagemErroHttp, type FetchLike } from "../rede";

export const GITHUB_API = "https://api.github.com";

export type EstadoGitHub =
  | "nao_configurado"
  | "configurado_nao_verificado"
  | "conectado_verificado"
  | "leitura_publica_verificada"
  | "erro";

export interface ResultadoGitHub<T> {
  ok: boolean;
  estado: EstadoGitHub;
  dados: T | null;
  mensagem: string;
}

export interface ResumoRepositorio {
  nomeCompleto: string;
  privado: boolean;
  branchPadrao: string;
  linguagem: string | null;
  url: string;
}

export interface ResumoBranch {
  nome: string;
  protegida: boolean;
  sha: string;
}

export interface ResumoCommit {
  sha: string;
  mensagem: string;
  autor: string | null;
  data: string;
}

export interface ResumoPullRequest {
  numero: number;
  titulo: string;
  estado: string;
  autor: string | null;
  criadoEm: string;
  url: string;
  head: string;
  base: string;
}

export interface ResumoWorkflow {
  id: number;
  nome: string;
  caminho: string;
  estado: string;
}

export interface ResumoStatusCI {
  estado: string;
  total: number;
  aprovados: number;
  falhas: number;
  pendentes: number;
}

export interface ConfiguracaoGitHub {
  token: string | null;
  /** Repositório autorizado, no formato "owner/repo". */
  repositorioAutorizado: string;
  /** Permite leitura somente de dados públicos do único repositório autorizado. */
  permitirLeituraPublica?: boolean;
}

export class AdaptadorGitHub {
  private estado: EstadoGitHub;

  constructor(
    private readonly config: ConfiguracaoGitHub,
    private readonly fetchImpl: FetchLike = fetchPadrao
  ) {
    this.estado = config.token ? "configurado_nao_verificado" : "nao_configurado";
  }

  estadoAtual(): EstadoGitHub {
    return this.estado;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "fire-agent-command-center",
    };
    if (this.config.token) headers.authorization = `Bearer ${this.config.token}`;
    return headers;
  }

  /** Recusa qualquer repositório fora do escopo autorizado. */
  private repoNoEscopo(repo: string): boolean {
    return repo.toLowerCase() === this.config.repositorioAutorizado.toLowerCase();
  }

  private async buscar<T>(caminho: string, padrao: (dados: unknown) => T | null): Promise<ResultadoGitHub<T>> {
    const leituraPublica = this.config.token === null;
    if (leituraPublica && !this.config.permitirLeituraPublica) {
      return {
        ok: false,
        estado: "nao_configurado",
        dados: null,
        mensagem: "Leitura pública do GitHub desativada. Nenhuma chamada foi feita.",
      };
    }
    try {
      const resposta = await this.fetchImpl(`${GITHUB_API}${caminho}`, { headers: this.headers() });
      const dados = await lerJson(resposta);
      if (!resposta.ok) {
        if (!leituraPublica && (resposta.status === 401 || resposta.status === 403)) this.estado = "erro";
        const estado = leituraPublica ? "nao_configurado" : this.estado;
        const mensagem = leituraPublica
          ? "Não foi possível ler o repositório publicamente; acesso privado exige token autorizado."
          : mensagemErroHttp(dados, resposta.status);
        return { ok: false, estado, dados: null, mensagem };
      }
      const convertido = padrao(dados);
      if (convertido === null) {
        return { ok: false, estado: this.estado, dados: null, mensagem: "Resposta inesperada da API do GitHub." };
      }
      this.estado = leituraPublica ? "leitura_publica_verificada" : "conectado_verificado";
      return {
        ok: true,
        estado: this.estado,
        dados: convertido,
        mensagem: leituraPublica ? "Leitura pública somente de leitura confirmada." : "OK",
      };
    } catch (erro) {
      this.estado = "erro";
      const mensagem = erro instanceof Error ? erro.message : "falha de rede";
      return { ok: false, estado: "erro", dados: null, mensagem: `Falha de comunicação com o GitHub: ${mensagem}` };
    }
  }

  async verificarRepositorio(repo = this.config.repositorioAutorizado): Promise<ResultadoGitHub<ResumoRepositorio>> {
    if (!this.repoNoEscopo(repo)) {
      return {
        ok: false,
        estado: this.estado,
        dados: null,
        mensagem: `Acesso recusado: "${repo}" está fora do escopo autorizado (${this.config.repositorioAutorizado}).`,
      };
    }
    const resultado = await this.buscar<ResumoRepositorio>(`/repos/${repo}`, (d) => {
      if (!d || typeof d !== "object") return null;
      const r = d as Record<string, unknown>;
      return {
        nomeCompleto: String(r.full_name ?? repo),
        privado: r.private === true,
        branchPadrao: String(r.default_branch ?? "main"),
        linguagem: typeof r.language === "string" ? r.language : null,
        url: String(r.html_url ?? ""),
      };
    });
    return resultado;
  }

  async listarBranches(repo = this.config.repositorioAutorizado): Promise<ResultadoGitHub<ResumoBranch[]>> {
    if (!this.repoNoEscopo(repo)) return foraDoEscopo(this.estado, repo, this.config.repositorioAutorizado);
    return this.buscar<ResumoBranch[]>(`/repos/${repo}/branches?per_page=100`, (d) => {
      if (!Array.isArray(d)) return null;
      return d.map((item) => {
        const b = item as Record<string, unknown>;
        const commit = (b.commit ?? {}) as Record<string, unknown>;
        return { nome: String(b.name ?? ""), protegida: b.protected === true, sha: String(commit.sha ?? "") };
      });
    });
  }

  async listarCommits(
    opcoes: { branch?: string; porPagina?: number } = {},
    repo = this.config.repositorioAutorizado
  ): Promise<ResultadoGitHub<ResumoCommit[]>> {
    if (!this.repoNoEscopo(repo)) return foraDoEscopo(this.estado, repo, this.config.repositorioAutorizado);
    const porPagina = Math.min(Math.max(opcoes.porPagina ?? 30, 1), 100);
    const params = new URLSearchParams({ per_page: String(porPagina) });
    if (opcoes.branch) params.set("sha", opcoes.branch);
    return this.buscar<ResumoCommit[]>(`/repos/${repo}/commits?${params.toString()}`, (d) => {
      if (!Array.isArray(d)) return null;
      return d.map((item) => {
        const c = item as Record<string, unknown>;
        const commit = (c.commit ?? {}) as Record<string, unknown>;
        const autor = (commit.author ?? {}) as Record<string, unknown>;
        return {
          sha: String(c.sha ?? ""),
          mensagem: String(commit.message ?? "").split("\n")[0],
          autor: typeof autor.name === "string" ? autor.name : null,
          data: String(autor.date ?? ""),
        };
      });
    });
  }

  async listarPullRequests(
    opcoes: { estado?: "open" | "closed" | "all"; porPagina?: number } = {},
    repo = this.config.repositorioAutorizado
  ): Promise<ResultadoGitHub<ResumoPullRequest[]>> {
    if (!this.repoNoEscopo(repo)) return foraDoEscopo(this.estado, repo, this.config.repositorioAutorizado);
    const params = new URLSearchParams({
      state: opcoes.estado ?? "open",
      per_page: String(Math.min(Math.max(opcoes.porPagina ?? 30, 1), 100)),
    });
    return this.buscar<ResumoPullRequest[]>(`/repos/${repo}/pulls?${params.toString()}`, (d) => {
      if (!Array.isArray(d)) return null;
      return d.map((item) => {
        const p = item as Record<string, unknown>;
        const usuario = (p.user ?? {}) as Record<string, unknown>;
        const head = (p.head ?? {}) as Record<string, unknown>;
        const base = (p.base ?? {}) as Record<string, unknown>;
        return {
          numero: Number(p.number ?? 0),
          titulo: String(p.title ?? ""),
          estado: String(p.state ?? ""),
          autor: typeof usuario.login === "string" ? usuario.login : null,
          criadoEm: String(p.created_at ?? ""),
          url: String(p.html_url ?? ""),
          head: String(head.ref ?? ""),
          base: String(base.ref ?? ""),
        };
      });
    });
  }

  async listarWorkflows(repo = this.config.repositorioAutorizado): Promise<ResultadoGitHub<ResumoWorkflow[]>> {
    if (!this.repoNoEscopo(repo)) return foraDoEscopo(this.estado, repo, this.config.repositorioAutorizado);
    return this.buscar<ResumoWorkflow[]>(`/repos/${repo}/actions/workflows`, (d) => {
      if (!d || typeof d !== "object") return null;
      const lista = (d as Record<string, unknown>).workflows;
      if (!Array.isArray(lista)) return null;
      return lista.map((item) => {
        const w = item as Record<string, unknown>;
        return {
          id: Number(w.id ?? 0),
          nome: String(w.name ?? ""),
          caminho: String(w.path ?? ""),
          estado: String(w.state ?? ""),
        };
      });
    });
  }

  async statusCI(ref: string, repo = this.config.repositorioAutorizado): Promise<ResultadoGitHub<ResumoStatusCI>> {
    if (!this.repoNoEscopo(repo)) return foraDoEscopo(this.estado, repo, this.config.repositorioAutorizado);
    const alvo = encodeURIComponent(ref.slice(0, 100));
    return this.buscar<ResumoStatusCI>(`/repos/${repo}/commits/${alvo}/status`, (d) => {
      if (!d || typeof d !== "object") return null;
      const r = d as Record<string, unknown>;
      const statuses = Array.isArray(r.statuses) ? (r.statuses as Record<string, unknown>[]) : [];
      const contar = (estado: string) => statuses.filter((s) => String(s.state) === estado).length;
      return {
        estado: String(r.state ?? "unknown"),
        total: statuses.length,
        aprovados: contar("success"),
        falhas: contar("failure") + contar("error"),
        pendentes: contar("pending"),
      };
    });
  }

  /**
   * Verifica uma evidência informada por um agente contra a realidade do
   * repositório. Só retorna verificado=true quando o alvo é CONFIRMADO.
   */
  async verificarEvidencia(
    tipo: "commit" | "branch" | "pull_request",
    referencia: string,
    repo = this.config.repositorioAutorizado
  ): Promise<{ verificado: boolean; mensagem: string; detalhe: string | null }> {
    if (!this.repoNoEscopo(repo)) {
      return { verificado: false, mensagem: `Referência fora do escopo autorizado: ${repo}.`, detalhe: null };
    }
    if (tipo === "commit") {
      const r = await this.buscar<{ sha: string; mensagem: string }>(`/repos/${repo}/commits/${encodeURIComponent(referencia.slice(0, 100))}`, (d) => {
        if (!d || typeof d !== "object") return null;
        return { sha: String((d as Record<string, unknown>).sha ?? ""), mensagem: "" };
      });
      return { verificado: r.ok, mensagem: r.ok ? "Commit confirmado no repositório autorizado." : r.mensagem, detalhe: r.ok ? referencia : null };
    }
    if (tipo === "branch") {
      const r = await this.buscar<ResumoBranch>(`/repos/${repo}/branches/${encodeURIComponent(referencia.slice(0, 100))}`, (d) => {
        if (!d || typeof d !== "object") return null;
        const b = d as Record<string, unknown>;
        const commit = (b.commit ?? {}) as Record<string, unknown>;
        return { nome: String(b.name ?? ""), protegida: b.protected === true, sha: String(commit.sha ?? "") };
      });
      return { verificado: r.ok, mensagem: r.ok ? "Branch confirmada no repositório autorizado." : r.mensagem, detalhe: r.dados?.sha ?? null };
    }
    const numero = Number(referencia.replace(/\D/g, ""));
    if (!Number.isFinite(numero) || numero <= 0) {
      return { verificado: false, mensagem: "Número de pull request inválido.", detalhe: null };
    }
    const r = await this.buscar<ResumoPullRequest>(`/repos/${repo}/pulls/${numero}`, (d) => {
      if (!d || typeof d !== "object") return null;
      const p = d as Record<string, unknown>;
      return {
        numero: Number(p.number ?? 0),
        titulo: String(p.title ?? ""),
        estado: String(p.state ?? ""),
        autor: null,
        criadoEm: "",
        url: String(p.html_url ?? ""),
        head: "",
        base: "",
      };
    });
    return { verificado: r.ok, mensagem: r.ok ? `PR #${numero} confirmado.` : r.mensagem, detalhe: r.ok ? `#${numero}` : null };
  }
}

function foraDoEscopo<T>(estado: EstadoGitHub, repo: string, autorizado: string): ResultadoGitHub<T> {
  return {
    ok: false,
    estado,
    dados: null,
    mensagem: `Acesso recusado: "${repo}" está fora do escopo autorizado (${autorizado}).`,
  };
}
