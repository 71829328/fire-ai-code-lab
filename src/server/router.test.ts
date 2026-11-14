import { describe, expect, it, vi } from "vitest";
import { lerConfig } from "./config";
import type { ApiRequest, ApiResponse } from "./http";
import { criarDependencias, handleRequest, type DependenciasServidor } from "./router";
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
  extra: { token?: string; body?: unknown; ip?: string; query?: Record<string, string> } = {}
): ApiRequest {
  return {
    method,
    path,
    query: extra.query ?? {},
    headers: extra.token ? { authorization: `Bearer ${extra.token}` } : {},
    body: extra.body ?? {},
    ip: extra.ip ?? "10.0.0.1",
  };
}

async function login(deps: DependenciasServidor, ip = "10.0.0.1"): Promise<string> {
  const resp = await handleRequest(
    req("POST", "/auth/login", { body: { email: "operador@exemplo.invalid", senha: SENHA_DEMO }, ip }),
    deps
  );
  expect(resp.status).toBe(200);
  return (resp.body as { token: string }).token;
}

describe("roteador server-side — rotas públicas", () => {
  it("GET /saude responde 200 sem autenticação", async () => {
    const { deps } = montar();
    const resp = await handleRequest(req("GET", "/saude"), deps);
    expect(resp.status).toBe(200);
    expect((resp.body as { ok: boolean }).ok).toBe(true);
  });

  it("POST /auth/login valida e rejeita credenciais inválidas", async () => {
    const { deps } = montar();
    const ruim = await handleRequest(req("POST", "/auth/login", { body: { email: "operador@exemplo.invalid", senha: "errada-123" } }), deps);
    expect(ruim.status).toBe(401);
    expect((ruim.body as { erro: string }).erro).toBe("nao_autenticado");

    const bom = await handleRequest(req("POST", "/auth/login", { body: { email: "operador@exemplo.invalid", senha: SENHA_DEMO } }), deps);
    expect(bom.status).toBe(200);
    expect((bom.body as { token: string }).token).toMatch(/^v1\./);
  });

  it("body malformado no login devolve 400", async () => {
    const { deps } = montar();
    const resp = await handleRequest(req("POST", "/auth/login", { body: { email: "x" } }), deps);
    expect(resp.status).toBe(400);
  });
});

describe("roteador server-side — proteção de rotas", () => {
  it("rota autenticada sem token devolve 401", async () => {
    const { deps } = montar();
    const resp = await handleRequest(req("GET", "/missoes"), deps);
    expect(resp.status).toBe(401);
  });

  it("token forjado é rejeitado (401)", async () => {
    const { deps } = montar();
    const resp = await handleRequest(req("GET", "/missoes", { token: "v1.aaa.bbb" }), deps);
    expect(resp.status).toBe(401);
  });

  it("com sessão válida, lista e cria missões (201)", async () => {
    const { deps } = montar();
    const token = await login(deps);

    const lista = await handleRequest(req("GET", "/missoes", { token }), deps);
    expect(lista.status).toBe(200);

    const criar = await handleRequest(
      req("POST", "/missoes", { token, body: { codigo: "LAB-R1", titulo: "Título", objetivo: "Objetivo da missão" } }),
      deps
    );
    expect(criar.status).toBe(201);
    expect((criar.body as { missao: { codigo: string } }).missao.codigo).toBe("LAB-R1");
  });

  it("rota inexistente devolve 404", async () => {
    const { deps } = montar();
    const token = await login(deps);
    const resp = await handleRequest(req("GET", "/nao-existe", { token }), deps);
    expect(resp.status).toBe(404);
  });
});

describe("roteador server-side — exposição segura de configuração", () => {
  it("GET /config devolve resumo sem segredos e Central de Conexões honesta", async () => {
    const { deps } = montar();
    const token = await login(deps);
    const resp = await handleRequest(req("GET", "/config", { token }), deps);
    expect(resp.status).toBe(200);
    const body = resp.body as { resumo: unknown; conexoes: { provedores: { id: string; estado: string }[] }; oauth: unknown[] };
    const serializado = JSON.stringify(body);
    expect(serializado).not.toContain(SEGREDO);
    expect(body.conexoes.provedores.find((p) => p.id === "github")?.estado).toBe("nao_configurado");
    expect(Array.isArray(body.oauth)).toBe(true);
  });
});

describe("roteador server-side — integrações", () => {
  it("testar GitHub sem token: estado nao_configurado, sem chamada real", async () => {
    const { deps } = montar();
    const token = await login(deps);
    const resp = await handleRequest(req("POST", "/integracoes/testar", { token, body: { id: "github" } }), deps);
    expect(resp.status).toBe(200);
    const body = resp.body as { id: string; ok: boolean; estado: string };
    expect(body.ok).toBe(false);
    expect(body.estado).toBe("nao_configurado");
  });

  it("GET /integracoes expõe a central sem declarar conexões", async () => {
    const { deps } = montar();
    const token = await login(deps);
    const resp = await handleRequest(req("GET", "/integracoes", { token }), deps);
    expect(resp.status).toBe(200);
    const provedores = (resp.body as { provedores: { estado: string }[] }).provedores;
    expect(provedores.some((p) => p.estado === "conectado_verificado")).toBe(false);
  });
});

describe("roteador server-side — isolamento de organização", () => {
  it("lista apenas a organização vinculada à sessão", async () => {
    const { deps, repo } = montar();
    const token = await login(deps);
    const usuario = await repo.buscarUsuarioPorEmail("operador@exemplo.invalid");
    expect(usuario).not.toBeNull();

    await repo.criarOrganizacao({
      id: "org-restrita",
      nome: "Organização restrita",
      ambiente: "demonstracao",
      criadoEm: new Date().toISOString(),
    });

    const resp = await handleRequest(req("GET", "/organizacoes", { token }), deps);
    expect(resp.status).toBe(200);
    const ids = (resp.body as { organizacoes: { id: string }[] }).organizacoes.map((org) => org.id);
    expect(ids).toEqual([usuario!.organizacaoId]);
    expect(ids).not.toContain("org-restrita");
  });

  it.each(["/execucoes/processar", "/execucoes/processar-simples"])(
    "%s processa somente o tenant da sessão",
    async (path) => {
      const { deps, repo } = montar();
      const token = await login(deps);
      const listarTodas = vi.spyOn(repo, "listarOrganizacoes");
      if (path === "/execucoes/processar") deps.leases.adquirir("run-de-outro-tenant");
      const resp = await handleRequest(req("POST", path, { token }), deps);
      expect(resp.status).toBe(200);
      expect(listarTodas).not.toHaveBeenCalled();
      if (path === "/execucoes/processar") {
        expect((resp.body as { leasesAtivos: string[] }).leasesAtivos).not.toContain("run-de-outro-tenant");
      }
    }
  );
});

describe("roteador server-side — rate limiting", () => {
  it("bloqueia força bruta no login (cota mais rígida)", async () => {
    const { deps } = montar();
    const ip = "203.0.113.9";
    let ultimo: ApiResponse | null = null;
    for (let i = 0; i < 11; i += 1) {
      ultimo = await handleRequest(req("POST", "/auth/login", { body: { email: "operador@exemplo.invalid", senha: "errada-123" }, ip }), deps);
    }
    expect(ultimo?.status).toBe(429);
    expect((ultimo?.body as { erro: string }).erro).toBe("limite_excedido");
  });
});
