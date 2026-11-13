// =====================================================================
// FIRE Agent Command Center — LAB-004
// Adaptador Vercel (SOMENTE LEITURA), restrito ao projeto autorizado.
//
// Escopo fixo: projeto "fire-agent-command-center". Qualquer outro projeto
// (ex.: "Yasmin Rocha") é RECUSADO antes de qualquer chamada de rede.
//
// Regras:
//   - API oficial (api.vercel.com) com token próprio, mantido no servidor.
//   - Somente leitura: nenhum deploy, promoção, rollback ou alteração.
//   - Sem token, o estado é explicitamente "nao_configurado" (sem chamadas).
// =====================================================================

import { fetchPadrao, lerJson, mensagemErroHttp, type FetchLike } from "../rede";

export const VERCEL_API = "https://api.vercel.com";

export type EstadoVercel = "nao_configurado" | "configurado_nao_verificado" | "conectado_verificado" | "erro";

export interface ResultadoVercel<T> {
  ok: boolean;
  estado: EstadoVercel;
  dados: T | null;
  mensagem: string;
}

export interface ResumoProjetoVercel {
  id: string;
  nome: string;
  framework: string | null;
  atualizadoEm: string;
}

export interface ResumoDeployment {
  id: string;
  url: string;
  estado: string;
  alvo: string | null;
  commitSha: string | null;
  branch: string | null;
  criadoEm: string;
}

export interface ResumoBuild {
  id: string;
  pronto: boolean;
  estado: string;
  criadoEm: string;
}

export interface EventoDeployment {
  tipo: string;
  criadoEm: number;
  texto: string;
}

export interface ResumoTestes {
  disponivel: boolean;
  motivo: string;
}

export interface ConfiguracaoVercel {
  token: string | null;
  projetoAutorizado: string;
  teamId: string | null;
}

export class AdaptadorVercel {
  private estado: EstadoVercel;

  constructor(
    private readonly config: ConfiguracaoVercel,
    private readonly fetchImpl: FetchLike = fetchPadrao
  ) {
    this.estado = config.token ? "configurado_nao_verificado" : "nao_configurado";
  }

  estadoAtual(): EstadoVercel {
    return this.estado;
  }

  private headers(): Record<string, string> {
    return {
      accept: "application/json",
      authorization: `Bearer ${this.config.token ?? ""}`,
    };
  }

  private escopo(extra: Record<string, string> = {}): URLSearchParams {
    const params = new URLSearchParams(extra);
    if (this.config.teamId) params.set("teamId", this.config.teamId);
    return params;
  }

  private async buscar<T>(caminho: string, padrao: (dados: unknown) => T | null): Promise<ResultadoVercel<T>> {
    if (!this.config.token) {
      return {
        ok: false,
        estado: "nao_configurado",
        dados: null,
        mensagem: "Vercel não configurado: token da aplicação ausente. Nenhuma chamada foi feita.",
      };
    }
    try {
      const resposta = await this.fetchImpl(`${VERCEL_API}${caminho}`, { headers: this.headers() });
      const dados = await lerJson(resposta);
      if (!resposta.ok) {
        if (resposta.status === 401 || resposta.status === 403) this.estado = "erro";
        return { ok: false, estado: this.estado, dados: null, mensagem: mensagemErroHttp(dados, resposta.status) };
      }
      const convertido = padrao(dados);
      if (convertido === null) {
        return { ok: false, estado: this.estado, dados: null, mensagem: "Resposta inesperada da API da Vercel." };
      }
      return { ok: true, estado: this.estado, dados: convertido, mensagem: "OK" };
    } catch (erro) {
      this.estado = "erro";
      const mensagem = erro instanceof Error ? erro.message : "falha de rede";
      return { ok: false, estado: "erro", dados: null, mensagem: `Falha de comunicação com a Vercel: ${mensagem}` };
    }
  }

  private projetoNoEscopo(projeto: string): boolean {
    return projeto.toLowerCase() === this.config.projetoAutorizado.toLowerCase();
  }

  async verificarProjeto(projeto = this.config.projetoAutorizado): Promise<ResultadoVercel<ResumoProjetoVercel>> {
    if (!this.projetoNoEscopo(projeto)) {
      return {
        ok: false,
        estado: this.estado,
        dados: null,
        mensagem: `Acesso recusado: "${projeto}" está fora do escopo autorizado (${this.config.projetoAutorizado}).`,
      };
    }
    const resultado = await this.buscar<ResumoProjetoVercel>(
      `/v9/projects/${encodeURIComponent(projeto)}?${this.escopo().toString()}`,
      (d) => {
        if (!d || typeof d !== "object") return null;
        const p = d as Record<string, unknown>;
        return {
          id: String(p.id ?? ""),
          nome: String(p.name ?? projeto),
          framework: typeof p.framework === "string" ? p.framework : null,
          atualizadoEm: typeof p.updatedAt === "number" ? new Date(p.updatedAt).toISOString() : "",
        };
      }
    );
    if (resultado.ok) this.estado = "conectado_verificado";
    return resultado;
  }

  async listarDeployments(
    opcoes: { limite?: number } = {},
    projeto = this.config.projetoAutorizado
  ): Promise<ResultadoVercel<ResumoDeployment[]>> {
    if (!this.projetoNoEscopo(projeto)) {
      return {
        ok: false,
        estado: this.estado,
        dados: null,
        mensagem: `Acesso recusado: "${projeto}" está fora do escopo autorizado.`,
      };
    }
    const params = this.escopo({ app: projeto, limit: String(Math.min(Math.max(opcoes.limite ?? 20, 1), 100)) });
    return this.buscar<ResumoDeployment[]>(`/v6/deployments?${params.toString()}`, (d) => {
      if (!d || typeof d !== "object") return null;
      const lista = (d as Record<string, unknown>).deployments;
      if (!Array.isArray(lista)) return null;
      return lista.map((item) => paraDeployment(item as Record<string, unknown>));
    });
  }

  async obterDeployment(id: string): Promise<ResultadoVercel<ResumoDeployment>> {
    const params = this.escopo();
    return this.buscar<ResumoDeployment>(`/v13/deployments/${encodeURIComponent(id)}?${params.toString()}`, (d) => {
      if (!d || typeof d !== "object") return null;
      return paraDeployment(d as Record<string, unknown>);
    });
  }

  async listarBuilds(deploymentId: string): Promise<ResultadoVercel<ResumoBuild[]>> {
    const params = this.escopo();
    return this.buscar<ResumoBuild[]>(
      `/v2/deployments/${encodeURIComponent(deploymentId)}/builds?${params.toString()}`,
      (d) => {
        if (!Array.isArray(d)) return null;
        return d.map((item) => {
          const b = item as Record<string, unknown>;
          return {
            id: String(b.id ?? ""),
            pronto: b.readyState === "READY" || b.ready === true,
            estado: String(b.readyState ?? b.state ?? ""),
            criadoEm: typeof b.createdAt === "number" ? new Date(b.createdAt).toISOString() : "",
          };
        });
      }
    );
  }

  async logsDeCompilacao(deploymentId: string, limite = 100): Promise<ResultadoVercel<EventoDeployment[]>> {
    const params = this.escopo({ direction: "forward", limit: String(Math.min(Math.max(limite, 1), 200)) });
    return this.buscar<EventoDeployment[]>(
      `/v3/deployments/${encodeURIComponent(deploymentId)}/events?${params.toString()}`,
      (d) => {
        if (!Array.isArray(d)) return null;
        return d.map((item) => {
          const e = item as Record<string, unknown>;
          return {
            tipo: String(e.type ?? ""),
            criadoEm: Number(e.created ?? 0),
            texto: String(e.text ?? "").slice(0, 500),
          };
        });
      }
    );
  }

  // A Vercel não expõe um endpoint oficial de "resultado de testes". Retornamos
  // honestamente "não disponível" em vez de inferir um resultado.
  resultadoTestes(): ResumoTestes {
    return {
      disponivel: false,
      motivo: "A API da Vercel não fornece resultados de teste; o resultado deve vir do CI do GitHub.",
    };
  }
}

function paraDeployment(d: Record<string, unknown>): ResumoDeployment {
  const meta = (d.meta ?? {}) as Record<string, unknown>;
  const commitMeta = (meta.githubCommitSha ?? meta.gitCommitSha) as string | undefined;
  return {
    id: String(d.uid ?? d.id ?? ""),
    url: String(d.url ?? ""),
    estado: String(d.readyState ?? d.state ?? ""),
    alvo: typeof d.target === "string" ? d.target : null,
    commitSha: typeof commitMeta === "string" ? commitMeta : null,
    branch: typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : null,
    criadoEm: typeof d.createdAt === "number" ? new Date(d.createdAt).toISOString() : "",
  };
}
