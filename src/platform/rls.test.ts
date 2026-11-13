import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MIGRACOES, listarMigracoes, migracoesPendentes, aplicarMigracoes } from "./migrations";

// Testes de invariante das migrações SQL (LAB-004).
//
// Não substituem os testes de RLS executados contra um PostgreSQL real
// (ver backend/scripts/rls-local.sh), mas garantem, no CI, que a correção
// obrigatória do CTO nunca regrida: a identidade NÃO pode voltar a aceitar
// app.usuario_id como caminho alternativo.

function lerSql(relativo: string): string {
  return readFileSync(resolve(process.cwd(), relativo), "utf8");
}

// Remove comentários SQL para que as invariantes sejam verificadas apenas
// sobre o código executável (menções explicativas em comentários são aceitas).
function semComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

const PRODUCAO = [
  "backend/migrations/0001_init.sql",
  "backend/migrations/0002_rls.sql",
  "backend/migrations/0003_indices_funcoes.sql",
  "backend/migrations/0004_seguranca.sql",
];

const STUB_LOCAL = "backend/migrations/local/0000_auth_stub_local.sql";

describe("migrações SQL — invariantes de segurança", () => {
  it("a identidade é resolvida exclusivamente por auth.uid()", () => {
    const sql = semComentarios(lerSql("backend/migrations/0002_rls.sql"));
    expect(sql).toContain("auth.uid()");
  });

  it("não existe caminho de identidade por app.usuario_id (correção do CTO)", () => {
    const sql = semComentarios(lerSql("backend/migrations/0002_rls.sql"));
    expect(sql).not.toMatch(/app\.usuario_id/);
    expect(sql).not.toMatch(/current_setting\(\s*'app\.usuario_id'/);
  });

  it("funções SECURITY DEFINER definem search_path", () => {
    const sql = semComentarios(lerSql("backend/migrations/0002_rls.sql"));
    const definer = sql.match(/security definer[\s\S]*?\$\$/g) ?? [];
    expect(definer.length).toBeGreaterThan(0);
    for (const trecho of definer) {
      expect(trecho).toMatch(/set search_path/);
    }
  });

  it("todas as migrações de produção carregam a guarda de aplicação", () => {
    for (const arquivo of PRODUCAO) {
      const sql = lerSql(arquivo);
      expect(sql).toContain("fire.allow_migrations");
      expect(sql).toContain("raise exception");
    }
  });

  it("0004 endurece auditoria, papéis, tenants e grants", () => {
    const sql = lerSql("backend/migrations/0004_seguranca.sql");
    expect(sql).toContain("audit_log_imutavel");
    expect(sql).toContain("protege_usuario");
    expect(sql).toContain("validar_tenant");
    expect(sql).toContain("protege_aprovacao");
    expect(sql).toContain("set search_path");
    expect(sql).toMatch(/revoke/i);
  });

  it("o stub de identidade de teste é isolado e nunca entra na lista de produção", () => {
    const stub = lerSql(STUB_LOCAL);
    expect(stub).toContain("fire.ambiente");
    expect(stub).toContain("teste_local");
    expect(stub).not.toMatch(/current_setting\(\s*'app\.usuario_id'/);

    for (const m of MIGRACOES) {
      expect(m.arquivo).not.toContain("/local/");
    }
  });
});

describe("catálogo de migrações", () => {
  it("lista 0001..0004, todas não aplicadas", () => {
    const versoes = listarMigracoes().map((m) => m.versao);
    expect(versoes).toEqual(["0001", "0002", "0003", "0004"]);
    expect(listarMigracoes().every((m) => m.aplicada === false)).toBe(true);
  });

  it("migracoesPendentes devolve todas e aplicarMigracoes é bloqueado", () => {
    expect(migracoesPendentes().length).toBe(MIGRACOES.length);
    const r = aplicarMigracoes();
    expect(r.aplicadas).toBe(0);
    expect(r.motivo).toMatch(/bloqueada/i);
  });
});
