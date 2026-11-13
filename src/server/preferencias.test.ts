import { describe, expect, it } from "vitest";
import { lerConfig } from "./config";
import { montarCentralConexoes } from "./conexoes";
import { PreferenciasProvedores } from "./preferencias";
import { criarDependencias, handleRequest, type DependenciasServidor } from "./router";
import type { ApiRequest } from "./http";
import { RepositorioMemoria, SENHA_DEMO } from "./store";

const SEGREDO = "segredo-de-teste";

function montar(): { deps: DependenciasServidor; repo: RepositorioMemoria } {
  const repo = new RepositorioMemoria();
  const deps = criarDependencias(lerConfig({ FIRE_SESSION_SECRET: SEGREDO }), { repo });
  return { deps, repo };
}

function req(
  method: string,
  path: string,
  extra: { token?: string; body?: unknown; ip?: string } = {}
): ApiRequest {
  return {
    method,
    path,
    query: {},
    headers: extra.token ? { authorization: `Bearer ${extra.token}` } : {},
    body: extra.body ?? {},
    ip: extra.ip ?? "10.0.0.1",
  };
}

async function login(deps: DependenciasServidor, email = "operador@exemplo.invalid"): Promise<string> {
  const resp = await handleRequest(req("POST", "/auth/login", { body: { email, senha: SENHA_DEMO } }), deps);
  expect(resp.status).toBe(200);
  return (resp.body as { token: string }).token;
}

describe("PreferenciasProvedores", () => {
  it("desativa, reativa e lista de forma determinística", () => {
    const prefs = new PreferenciasProvedores();
    expect(prefs.estaDesativado("github")).toBe(false);
    prefs.desativar("vercel");
    prefs.desativar("github");
    expect(prefs.listar()).toEqual(["github", "vercel"]);
    expect(prefs.estaDesativado("github")).toBe(true);
    prefs.ativar("github");
    expect(prefs.listar()).toEqual(["vercel"]);
    prefs.limpar();
    expect(prefs.listar()).toEqual([]);
  });
});

describe("Central de Conexões — kill switch honesto", () => {
  it("provedor desativado nunca aparece conectado, mesmo com credencial e verificação", () => {
    const central = montarCentralConexoes({
      config: lerConfig({ GITHUB_TOKEN: "tok" }),
      modoRepositorio: "memoria",
      persistente: false,
      mensagemRepositorio: "em memória",
      estadoSupabase: "nao_configurado",
      estadoGitHub: "conectado_verificado",
      estadoVercel: "nao_configurado",
      provedoresDesativados: ["github"],
    });
    const github = central.provedores.find((p) => p.id === "github")!;
    expect(github.estado).toBe("indisponivel");
    expect(github.desativadoPeloOperador).toBe(true);
    expect(github.permissoes).toEqual([]);
  });
});

describe("estado público da Central de Conexões", () => {
  it("GET /conexoes/publico é público e honesto (nada conectado sem configuração)", async () => {
    const { deps } = montar();
    const resp = await handleRequest(req("GET", "/conexoes/publico"), deps);
    expect(resp.status).toBe(200);
    const body = resp.body as { ambiente: string; conexoes: { provedores: { id: string; estado: string }[] } };
    expect(typeof body.ambiente).toBe("string");
    expect(body.conexoes.provedores.find((p) => p.id === "github")?.estado).toBe("nao_configurado");
    expect(body.conexoes.provedores.some((p) => p.estado === "conectado_verificado")).toBe(false);
  });

  it("estado público nunca vaza o valor do token", async () => {
    const repo = new RepositorioMemoria();
    const deps = criarDependencias(
      lerConfig({ FIRE_SESSION_SECRET: SEGREDO, GITHUB_TOKEN: "ghp_segredo_nao_pode_vazar_123" }),
      { repo }
    );
    const resp = await handleRequest(req("GET", "/conexoes/publico"), deps);
    expect(resp.status).toBe(200);
    expect(JSON.stringify(resp.body)).not.toContain("ghp_segredo_nao_pode_vazar_123");
  });
});

describe("rota /integracoes/ativacao", () => {
  it("desativa um provedor e impede o teste real (503)", async () => {
    const { deps } = montar();
    const token = await login(deps);

    const desativar = await handleRequest(
      req("POST", "/integracoes/ativacao", { token, body: { id: "github", ativo: false } }),
      deps
    );
    expect(desativar.status).toBe(200);
    const corpo = desativar.body as { id: string; ativo: boolean; conexoes: { provedores: { id: string; estado: string; desativadoPeloOperador?: boolean }[] } };
    expect(corpo.ativo).toBe(false);
    const github = corpo.conexoes.provedores.find((p) => p.id === "github")!;
    expect(github.estado).toBe("indisponivel");
    expect(github.desativadoPeloOperador).toBe(true);

    const testar = await handleRequest(req("POST", "/integracoes/testar", { token, body: { id: "github" } }), deps);
    expect(testar.status).toBe(503);
    expect((testar.body as { erro: string }).erro).toBe("indisponivel");
  });

  it("reativar restaura o estado real do provedor", async () => {
    const { deps } = montar();
    const token = await login(deps);
    await handleRequest(req("POST", "/integracoes/ativacao", { token, body: { id: "github", ativo: false } }), deps);
    const reativar = await handleRequest(req("POST", "/integracoes/ativacao", { token, body: { id: "github", ativo: true } }), deps);
    expect(reativar.status).toBe(200);
    const github = (reativar.body as { conexoes: { provedores: { id: string; estado: string; desativadoPeloOperador?: boolean }[] } }).conexoes.provedores.find((p) => p.id === "github")!;
    expect(github.estado).toBe("nao_configurado");
    expect(github.desativadoPeloOperador).toBeUndefined();
  });

  it("sem permissão (observador) devolve 403", async () => {
    const { deps } = montar();
    const tokenObs = await login(deps, "observador@exemplo.invalid");
    const resp = await handleRequest(req("POST", "/integracoes/ativacao", { token: tokenObs, body: { id: "github", ativo: false } }), deps);
    expect(resp.status).toBe(403);
  });

  it("corpo inválido devolve 400", async () => {
    const { deps } = montar();
    const token = await login(deps);
    const resp = await handleRequest(req("POST", "/integracoes/ativacao", { token, body: { id: "github", ativo: "sim" } }), deps);
    expect(resp.status).toBe(400);
  });
});
