import { describe, expect, it } from "vitest";
import { ClienteAuth, RepositorioSupabase, criarClienteAuth, supabaseConfigurado } from "./supabase";
import type { FetchLike } from "./rede";

interface Chamada {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

function fakeFetch(respostas: Array<{ ok: boolean; status: number; body: unknown }>) {
  const chamadas: Chamada[] = [];
  let i = 0;
  const fn: FetchLike = async (url, init) => {
    chamadas.push({ url, init });
    const r = respostas[Math.min(i, respostas.length - 1)];
    i += 1;
    return { ok: r.ok, status: r.status, text: async () => (typeof r.body === "string" ? r.body : JSON.stringify(r.body)) };
  };
  return { fn, chamadas };
}

const CONFIG_OK = { url: "https://proj.supabase.co", anonKey: "anon", serviceRoleKey: "service" };

describe("RepositorioSupabase (adaptador real, desconectado por padrão)", () => {
  it("sem url/chave de serviço: estado nao_configurado e nenhuma chamada", async () => {
    const { fn, chamadas } = fakeFetch([{ ok: true, status: 200, body: [] }]);
    const repo = new RepositorioSupabase({ url: null, anonKey: null, serviceRoleKey: null }, fn);
    const r = await repo.verificarConexao();
    expect(r.estado).toBe("nao_configurado");
    expect(chamadas).toHaveLength(0);
  });

  it("só marca 'verificado' após resposta 2xx real", async () => {
    const { fn } = fakeFetch([{ ok: true, status: 200, body: [] }]);
    const repo = new RepositorioSupabase(CONFIG_OK, fn);
    const r = await repo.verificarConexao();
    expect(r.estado).toBe("verificado");
    expect(repo.estado()).toBe("verificado");
  });

  it("resposta de erro marca 'erro'", async () => {
    const { fn } = fakeFetch([{ ok: false, status: 500, body: { message: "falha" } }]);
    const repo = new RepositorioSupabase(CONFIG_OK, fn);
    const r = await repo.verificarConexao();
    expect(r.estado).toBe("erro");
  });

  it("mapeia linhas de organizações para o modelo de domínio", async () => {
    const { fn } = fakeFetch([
      { ok: true, status: 200, body: [{ id: "org-1", nome: "Org", criado_em: "2026-01-01T00:00:00Z", ambiente: "homologacao" }] },
    ]);
    const repo = new RepositorioSupabase(CONFIG_OK, fn);
    const orgs = await repo.listarOrganizacoes();
    expect(orgs[0]).toEqual({ id: "org-1", nome: "Org", criadoEm: "2026-01-01T00:00:00Z", ambiente: "homologacao" });
  });

  it("nunca expõe hash de senha (autenticação é delegada ao GoTrue)", async () => {
    const { fn } = fakeFetch([{ ok: true, status: 200, body: [{ id: "u1", organizacao_id: "org-1", nome: "N", email: "n@x.invalid", papel: "operador", ativo: true }] }]);
    const repo = new RepositorioSupabase(CONFIG_OK, fn);
    const usuario = await repo.buscarUsuario("u1");
    expect(usuario?.senhaHash).toBe("");
  });
});

describe("ClienteAuth (GoTrue)", () => {
  it("login bem-sucedido devolve access token e usuário", async () => {
    const { fn, chamadas } = fakeFetch([
      { ok: true, status: 200, body: { access_token: "jwt-abc", expires_in: 3600, user: { id: "u1", email: "n@x.invalid" } } },
    ]);
    const auth = new ClienteAuth("https://proj.supabase.co", "anon", fn);
    const r = await auth.loginComSenha("n@x.invalid", "senha");
    expect(r.ok).toBe(true);
    expect(r.accessToken).toBe("jwt-abc");
    expect(r.usuario?.id).toBe("u1");
    expect(chamadas[0].url).toContain("/auth/v1/token?grant_type=password");
    expect(chamadas[0].init?.body).toContain("password");
  });

  it("login inválido não inventa sessão", async () => {
    const { fn } = fakeFetch([{ ok: false, status: 400, body: { error_description: "Invalid login credentials" } }]);
    const auth = new ClienteAuth("https://proj.supabase.co", "anon", fn);
    const r = await auth.loginComSenha("n@x.invalid", "errada");
    expect(r.ok).toBe(false);
    expect(r.accessToken).toBeNull();
    expect(r.erro).toContain("Invalid login credentials");
  });
});

describe("helpers de configuração", () => {
  it("supabaseConfigurado exige url e anonKey", () => {
    expect(supabaseConfigurado({ url: "https://x", anonKey: "a", serviceRoleKey: null })).toBe(true);
    expect(supabaseConfigurado({ url: "https://x", anonKey: null, serviceRoleKey: null })).toBe(false);
  });

  it("criarClienteAuth devolve null sem credenciais", () => {
    expect(criarClienteAuth({ url: null, anonKey: null, serviceRoleKey: null })).toBeNull();
    expect(criarClienteAuth(CONFIG_OK)).toBeInstanceOf(ClienteAuth);
  });
});
