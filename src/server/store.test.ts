import { describe, expect, it } from "vitest";
import {
  criarEstadoServidorSeed,
  ORG_DEMO_ID,
  ORG_LAB_ID,
  RepositorioMemoria,
  SENHA_DEMO,
} from "./store";

describe("RepositorioMemoria", () => {
  const repo = new RepositorioMemoria();

  it("descreve-se como não persistente", () => {
    const d = repo.descrever();
    expect(d.modo).toBe("memoria");
    expect(d.persistente).toBe(false);
    expect(repo.persistente).toBe(false);
  });

  it("semeia duas organizações isoladas", async () => {
    const orgs = await repo.listarOrganizacoes();
    expect(orgs.map((o) => o.id)).toEqual([ORG_DEMO_ID, ORG_LAB_ID]);
  });

  it("lista usuários por organização SEM expor o hash de senha", async () => {
    const usuarios = await repo.listarUsuarios(ORG_DEMO_ID);
    expect(usuarios.length).toBeGreaterThan(0);
    expect(usuarios.every((u) => !("senhaHash" in u))).toBe(true);
  });

  it("busca usuário por e-mail sem diferenciar maiúsculas/minúsculas", async () => {
    const u = await repo.buscarUsuarioPorEmail("OPERADOR@EXEMPLO.INVALID");
    expect(u?.id).toBe("us-owner");
    expect(u?.senhaHash).toContain("scrypt$");
  });

  it("em modo produção não semeia usuários com senha conhecida", () => {
    const estado = criarEstadoServidorSeed(true);
    expect(estado.usuarios).toHaveLength(0);
  });

  it("auditoria é append-only e mais recente primeiro", async () => {
    const local = new RepositorioMemoria();
    await local.registrarAuditoria({ id: "a1", organizacaoId: ORG_DEMO_ID, usuarioId: null, acao: "1", recurso: "x", recursoId: null, resultado: "info", timestamp: "2026-01-01T00:00:00Z" });
    await local.registrarAuditoria({ id: "a2", organizacaoId: ORG_DEMO_ID, usuarioId: null, acao: "2", recurso: "x", recursoId: null, resultado: "info", timestamp: "2026-01-02T00:00:00Z" });
    const lista = await local.listarAuditoria(ORG_DEMO_ID, 10);
    expect(lista.map((a) => a.id)).toEqual(["a2", "a1"]);
  });

  it("stores e runs ficam isolados por organização", async () => {
    const local = new RepositorioMemoria();
    await local.criarMissao({
      id: "m-1", organizacaoId: ORG_LAB_ID, codigo: "L", titulo: "t", prioridade: "media", status: "pendente",
      dependencias: [], agenteId: null, instrucoes: "", criteriosAceite: [], objetivo: "o", criadoEm: "2026-01-01T00:00:00Z",
    });
    expect(await local.buscarMissao(ORG_DEMO_ID, "m-1")).toBeNull();
    expect((await local.buscarMissao(ORG_LAB_ID, "m-1"))?.id).toBe("m-1");
  });

  it("a senha de demonstração é conhecida apenas na semente de dev/teste", () => {
    expect(SENHA_DEMO).toBe("fire-demo-2026");
  });
});
