import { describe, expect, it } from "vitest";
import {
  autorizar,
  organizacaoAtiva,
  pertenceAOrganizacao,
  permissoesDoPapel,
  temPermissao,
  usuariosDaOrganizacao,
} from "./authz";
import type { Organizacao, Papel, Usuario } from "./types";

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: "us-1",
    organizacaoId: "org-1",
    nome: "Fulano",
    email: "fulano@exemplo.invalid",
    papel: "operador",
    ativo: true,
    criadoEm: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("authz — permissões por papel", () => {
  it("operador possui missao:executar mas não missao:aprovar", () => {
    expect(temPermissao(usuario({ papel: "operador" }), "missao:executar")).toBe(true);
    expect(temPermissao(usuario({ papel: "operador" }), "missao:aprovar")).toBe(false);
  });

  it("revisor possui missao:aprovar e evidencia:verificar", () => {
    const revisor = usuario({ papel: "revisor" });
    expect(temPermissao(revisor, "missao:aprovar")).toBe(true);
    expect(temPermissao(revisor, "evidencia:verificar")).toBe(true);
  });

  it("observador possui apenas auditoria:ler", () => {
    expect(permissoesDoPapel(usuario({ papel: "observador" }))).toEqual(["auditoria:ler"]);
  });

  it("proprietário possui todas as permissões do catálogo", () => {
    const permissoes = permissoesDoPapel(usuario({ papel: "proprietario" as Papel }));
    expect(permissoes).toContain("organizacao:gerenciar");
    expect(permissoes).toContain("missao:aprovar");
    expect(permissoes).toContain("evidencia:verificar");
  });
});

describe("authz — decisão de autorização (menor privilégio + isolamento)", () => {
  it("nega quando não há usuário autenticado", () => {
    const d = autorizar(null, "missao:executar", "org-1");
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/Nenhum usuário/);
  });

  it("nega usuário inativo", () => {
    const d = autorizar(usuario({ ativo: false }), "missao:executar", "org-1");
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/inativo/i);
  });

  it("nega acesso a recurso de outra organização", () => {
    const d = autorizar(usuario({ organizacaoId: "org-1" }), "missao:executar", "org-2");
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/outra organização/);
  });

  it("nega quando o papel não possui a permissão", () => {
    const d = autorizar(usuario({ papel: "observador" }), "missao:executar", "org-1");
    expect(d.permitido).toBe(false);
    expect(d.motivo).toMatch(/não possui a permissão/);
  });

  it("permite quando ativo, na organização correta e com permissão", () => {
    const d = autorizar(usuario(), "missao:executar", "org-1");
    expect(d.permitido).toBe(true);
  });
});

describe("authz — isolamento entre organizações", () => {
  const organizacoes: Organizacao[] = [
    { id: "org-1", nome: "Um", criadoEm: "2026-01-01T00:00:00.000Z", ambiente: "demonstracao" },
    { id: "org-2", nome: "Dois", criadoEm: "2026-01-01T00:00:00.000Z", ambiente: "homologacao" },
  ];
  const usuarios: Usuario[] = [
    usuario({ id: "u1", organizacaoId: "org-1" }),
    usuario({ id: "u2", organizacaoId: "org-1" }),
    usuario({ id: "u3", organizacaoId: "org-2" }),
  ];

  it("usuariosDaOrganizacao só retorna membros da organização informada", () => {
    const membros = usuariosDaOrganizacao(usuarios, "org-1");
    expect(membros.map((m) => m.id)).toEqual(["u1", "u2"]);
  });

  it("organizacaoAtiva retorna null quando o id não existe", () => {
    expect(organizacaoAtiva(organizacoes, "org-2")?.nome).toBe("Dois");
    expect(organizacaoAtiva(organizacoes, "org-x")).toBeNull();
  });

  it("pertenceAOrganizacao exige usuário ativo e mesmo id", () => {
    expect(pertenceAOrganizacao(usuario({ organizacaoId: "org-1" }), "org-1")).toBe(true);
    expect(pertenceAOrganizacao(usuario({ organizacaoId: "org-1", ativo: false }), "org-1")).toBe(false);
    expect(pertenceAOrganizacao(usuario({ organizacaoId: "org-2" }), "org-1")).toBe(false);
    expect(pertenceAOrganizacao(null, "org-1")).toBe(false);
  });
});
