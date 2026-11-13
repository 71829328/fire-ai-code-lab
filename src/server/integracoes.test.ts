import { describe, expect, it } from "vitest";
import type { FetchLike, RespostaMinima } from "./rede";
import { AdaptadorGitHub } from "./integracoes/github";
import { AdaptadorVercel } from "./integracoes/vercel";

const REPO = "71829328/fire-ai-code-lab";
const PROJETO = "fire-agent-command-center";

interface Chamada {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

interface RespostaFalsa {
  ok: boolean;
  status: number;
  body: unknown;
}

function fakeFetch(respostas: RespostaFalsa[]): { fn: FetchLike; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  let indice = 0;
  const fn: FetchLike = async (url, init) => {
    chamadas.push({ url, init });
    const r = respostas[Math.min(indice, respostas.length - 1)];
    indice += 1;
    const resposta: RespostaMinima = {
      ok: r.ok,
      status: r.status,
      text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)),
    };
    return resposta;
  };
  return { fn, chamadas };
}

function fetchQueFalha(mensagem: string): { fn: FetchLike; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  const fn: FetchLike = async (url, init) => {
    chamadas.push({ url, init });
    throw new Error(mensagem);
  };
  return { fn, chamadas };
}

/* ------------------------------------------------------------------ */
/* GitHub                                                              */
/* ------------------------------------------------------------------ */

describe("Adaptador GitHub (somente leitura, escopo restrito)", () => {
  it("sem token: estado nao_configurado e NENHUMA chamada de rede", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: {} }]);
    const gh = new AdaptadorGitHub({ token: null, repositorioAutorizado: REPO }, fn);
    const r = await gh.verificarRepositorio();
    expect(gh.estadoAtual()).toBe("nao_configurado");
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/não configurado/i);
    expect(chamadas).toHaveLength(0);
  });

  it("recusa repositório fora do escopo ANTES de qualquer chamada", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: {} }]);
    const gh = new AdaptadorGitHub({ token: "tok-abc", repositorioAutorizado: REPO }, fn);
    const r = await gh.verificarRepositorio("outro-usuario/outro-repo");
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/fora do escopo/i);
    expect(chamadas).toHaveLength(0);
  });

  it("só marca 'conectado_verificado' após uma chamada real 2xx", async () => {
    const { fn } = fakeFetch([
      { ok: true, status: 200, body: { full_name: REPO, private: true, default_branch: "main", language: "TypeScript", html_url: "https://github.com/x" } },
    ]);
    const gh = new AdaptadorGitHub({ token: "tok-abc", repositorioAutorizado: REPO }, fn);
    expect(gh.estadoAtual()).toBe("configurado_nao_verificado");
    const r = await gh.verificarRepositorio();
    expect(r.ok).toBe(true);
    expect(gh.estadoAtual()).toBe("conectado_verificado");
    expect(r.dados?.branchPadrao).toBe("main");
  });

  it("envia o token no cabeçalho Authorization (server-side)", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: { full_name: REPO } }]);
    const gh = new AdaptadorGitHub({ token: "tok-secreto", repositorioAutorizado: REPO }, fn);
    await gh.verificarRepositorio();
    expect(chamadas[0].init?.headers?.authorization).toBe("Bearer tok-secreto");
    expect(chamadas[0].url).toBe(`https://api.github.com/repos/${REPO}`);
  });

  it("401/403 marcam estado 'erro'", async () => {
    const { fn } = fakeFetch([{ ok: false, status: 401, body: { message: "Bad credentials" } }]);
    const gh = new AdaptadorGitHub({ token: "tok-ruim", repositorioAutorizado: REPO }, fn);
    const r = await gh.verificarRepositorio();
    expect(r.ok).toBe(false);
    expect(gh.estadoAtual()).toBe("erro");
  });

  it("falha de comunicação vira estado 'erro' sem vazar o token", async () => {
    const { fn } = fetchQueFalha("timeout");
    const gh = new AdaptadorGitHub({ token: "tok-secreto-xyz", repositorioAutorizado: REPO }, fn);
    const r = await gh.verificarRepositorio();
    expect(gh.estadoAtual()).toBe("erro");
    expect(r.mensagem).toMatch(/Falha de comunicação/i);
    expect(JSON.stringify(r)).not.toContain("tok-secreto-xyz");
  });

  it("lista commits do repositório autorizado com mapeamento correto", async () => {
    const { fn, chamadas } = fakeFetch([
      {
        ok: true,
        status: 200,
        body: [
          { sha: "abc123", commit: { message: "feat: algo\n\ncorpo", author: { name: "Dev", date: "2026-01-01T00:00:00Z" } } },
        ],
      },
    ]);
    const gh = new AdaptadorGitHub({ token: "tok", repositorioAutorizado: REPO }, fn);
    const r = await gh.listarCommits({ branch: "main" });
    expect(r.ok).toBe(true);
    expect(r.dados?.[0]).toMatchObject({ sha: "abc123", mensagem: "feat: algo", autor: "Dev" });
    expect(chamadas[0].url).toContain(`/repos/${REPO}/commits?`);
    expect(chamadas[0].url).toContain("sha=main");
  });

  it("verificação de evidência só confirma com resposta 2xx real", async () => {
    const { fn } = fakeFetch([{ ok: true, status: 200, body: { sha: "deadbeef" } }]);
    const gh = new AdaptadorGitHub({ token: "tok", repositorioAutorizado: REPO }, fn);
    const ok = await gh.verificarEvidencia("commit", "deadbeef");
    expect(ok.verificado).toBe(true);
    expect(ok.detalhe).toBe("deadbeef");
  });
});

/* ------------------------------------------------------------------ */
/* Vercel                                                              */
/* ------------------------------------------------------------------ */

describe("Adaptador Vercel (somente leitura, projeto fixo)", () => {
  it("sem token: nao_configurado e nenhuma chamada", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: {} }]);
    const vc = new AdaptadorVercel({ token: null, projetoAutorizado: PROJETO, teamId: null }, fn);
    const r = await vc.verificarProjeto();
    expect(vc.estadoAtual()).toBe("nao_configurado");
    expect(r.ok).toBe(false);
    expect(chamadas).toHaveLength(0);
  });

  it("recusa outro projeto (ex.: Yasmin Rocha) sem tocar a rede", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: {} }]);
    const vc = new AdaptadorVercel({ token: "tok", projetoAutorizado: PROJETO, teamId: null }, fn);
    const r = await vc.verificarProjeto("yasmin-rocha");
    expect(r.ok).toBe(false);
    expect(r.mensagem).toMatch(/fora do escopo/i);
    expect(chamadas).toHaveLength(0);
  });

  it("verifica o projeto autorizado com chamada real", async () => {
    const { fn, chamadas } = fakeFetch([
      { ok: true, status: 200, body: { id: "prj_1", name: PROJETO, framework: "vite", updatedAt: 1_700_000_000_000 } },
    ]);
    const vc = new AdaptadorVercel({ token: "tok", projetoAutorizado: PROJETO, teamId: "team-1" }, fn);
    const r = await vc.verificarProjeto();
    expect(r.ok).toBe(true);
    expect(vc.estadoAtual()).toBe("conectado_verificado");
    expect(chamadas[0].url).toContain("teamId=team-1");
  });

  it("declara honestamente que a Vercel não fornece resultado de testes", () => {
    const vc = new AdaptadorVercel({ token: null, projetoAutorizado: PROJETO, teamId: null });
    expect(vc.resultadoTestes()).toMatchObject({ disponivel: false });
  });

  it("403 marca estado 'erro'", async () => {
    const { fn } = fakeFetch([{ ok: false, status: 403, body: { error: { message: "forbidden" } } }]);
    const vc = new AdaptadorVercel({ token: "tok", projetoAutorizado: PROJETO, teamId: null }, fn);
    const r = await vc.verificarProjeto();
    expect(r.ok).toBe(false);
    expect(vc.estadoAtual()).toBe("erro");
  });
});
