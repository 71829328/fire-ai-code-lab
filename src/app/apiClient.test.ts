import { describe, expect, it } from "vitest";
import { criarApiCliente, armazenamentoMemoria, type FetchLike } from "./apiClient";

interface Chamada {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function fetchFake(
  handler: (c: Chamada) => { status: number; body?: unknown }
): { fetchImpl: FetchLike; chamadas: Chamada[] } {
  const chamadas: Chamada[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const chamada: Chamada = { url, method: init?.method, headers: init?.headers, body: init?.body };
    chamadas.push(chamada);
    const r = handler(chamada);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? {},
    };
  };
  return { fetchImpl, chamadas };
}

const SESSAO = {
  token: "v1.abc.def",
  expiraEm: Date.now() + 1000,
  usuario: { id: "u1", organizacaoId: "org-demo", nome: "Op", email: "op@exemplo.invalid", papel: "proprietario", ativo: true, criadoEm: "" },
};

describe("cliente de API — token somente em memória", () => {
  it("login grava o token em memória e passa a enviá-lo no cabeçalho", async () => {
    const { fetchImpl, chamadas } = fetchFake((c) =>
      c.url.endsWith("/auth/login") ? { status: 200, body: SESSAO } : { status: 200, body: { provedores: [] } }
    );
    const memoria = armazenamentoMemoria();
    const api = criarApiCliente({ baseUrl: "https://exemplo.test/api/", fetchImpl, armazenamento: memoria });

    expect(api.temToken()).toBe(false);
    const resultado = await api.login("op@exemplo.invalid", "senha-forte");
    expect(resultado.ok).toBe(true);
    expect(api.temToken()).toBe(true);

    await api.integracoes();
    const segunda = chamadas[1];
    expect(segunda.headers?.authorization).toBe("Bearer v1.abc.def");
    // A URL preserva a base sem duplicar barras.
    expect(segunda.url).toBe("https://exemplo.test/api/integracoes");
  });

  it("login inválido NÃO grava token", async () => {
    const { fetchImpl } = fetchFake(() => ({ status: 401, body: { erro: "nao_autenticado", mensagem: "Credenciais inválidas." } }));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.login("op@exemplo.invalid", "errada");
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.motivo).toBe("nao_autenticado");
    expect(api.temToken()).toBe(false);
  });

  it("sem token, nenhuma rota recebe cabeçalho de autorização", async () => {
    const { fetchImpl, chamadas } = fetchFake(() => ({ status: 200, body: { ok: true, ambiente: "teste", hora: "" } }));
    const api = criarApiCliente({ fetchImpl });
    await api.saude();
    expect(chamadas[0].headers?.authorization).toBeUndefined();
  });

  it("limparToken remove a sessão em memória", async () => {
    const { fetchImpl } = fetchFake(() => ({ status: 200, body: SESSAO }));
    const api = criarApiCliente({ fetchImpl });
    await api.login("op@exemplo.invalid", "senha-forte");
    expect(api.temToken()).toBe(true);
    api.limparToken();
    expect(api.temToken()).toBe(false);
  });
});

describe("cliente de API — tratamento honesto de falhas", () => {
  it("falha de rede é reportada como 'rede', sem dados presumidos", async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error("offline"));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.integracoes();
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toBe("rede");
      expect(resultado.status).toBeNull();
    }
  });

  it("401 é 'nao_autenticado' e 429 é 'rate_limit'", async () => {
    const um = criarApiCliente({ fetchImpl: fetchFake(() => ({ status: 401, body: { mensagem: "Sessão inválida." } })).fetchImpl });
    const r1 = await um.sessao();
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.motivo).toBe("nao_autenticado");

    const dois = criarApiCliente({ fetchImpl: fetchFake(() => ({ status: 429, body: { mensagem: "Muitas requisições." } })).fetchImpl });
    const r2 = await dois.saude();
    expect(r2.ok).toBe(false);
    if (!r2.ok) {
      expect(r2.motivo).toBe("rate_limit");
      expect(r2.mensagem).toContain("Muitas");
    }
  });

  it("erro HTTP genérico vira motivo 'http' mantendo a mensagem do servidor", async () => {
    const { fetchImpl } = fetchFake(() => ({ status: 500, body: { mensagem: "Erro interno do servidor." } }));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.config();
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.motivo).toBe("http");
      expect(resultado.status).toBe(500);
      expect(resultado.mensagem).toBe("Erro interno do servidor.");
    }
  });

  it("resposta de sucesso devolve os dados do servidor", async () => {
    const { fetchImpl } = fetchFake(() => ({ status: 200, body: { provedores: [{ id: "github", estado: "nao_configurado" }] } }));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.integracoes();
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.provedores[0].id).toBe("github");
    }
  });
});

describe("cliente de API — chamadas de integração", () => {
  it("testarProvedor envia POST com o id", async () => {
    const { fetchImpl, chamadas } = fetchFake(() => ({ status: 200, body: { id: "github", ok: false, estado: "nao_configurado", mensagem: "sem token", detalhe: null } }));
    const api = criarApiCliente({ fetchImpl });
    await api.testarProvedor("github");
    expect(chamadas[0].method).toBe("POST");
    expect(chamadas[0].url).toBe("/api/integracoes/testar");
    expect(JSON.parse(chamadas[0].body ?? "{}")).toEqual({ id: "github" });
  });

  it("definirAtivacaoProvedor envia POST com id e ativo", async () => {
    const { fetchImpl, chamadas } = fetchFake(() => ({ status: 200, body: { id: "github", ativo: false, conexoes: { provedores: [] } } }));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.definirAtivacaoProvedor("github", false);
    expect(resultado.ok).toBe(true);
    expect(chamadas[0].url).toBe("/api/integracoes/ativacao");
    expect(JSON.parse(chamadas[0].body ?? "{}")).toEqual({ id: "github", ativo: false });
  });

  it("conexoesPublicas consulta o estado público sem autenticação", async () => {
    const { fetchImpl, chamadas } = fetchFake(() => ({ status: 200, body: { ambiente: "teste", geradoEm: "2026-01-01T00:00:00.000Z", conexoes: { provedores: [] } } }));
    const api = criarApiCliente({ fetchImpl });
    const resultado = await api.conexoesPublicas();
    expect(resultado.ok).toBe(true);
    expect(chamadas[0].method).toBe("GET");
    expect(chamadas[0].url).toBe("/api/conexoes/publico");
    expect(chamadas[0].headers?.authorization).toBeUndefined();
  });
});
