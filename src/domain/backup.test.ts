import { describe, expect, it } from "vitest";
import { BACKUP_APLICACAO, parseBackup, serializarBackup } from "./backup";
import { createSeedState } from "../data/seed";

describe("backup — exportação e importação segura", () => {
  it("serializa um envelope versionado com metadados", () => {
    const texto = serializarBackup(createSeedState(), "2024-05-05T00:00:00.000Z");
    const parsed = JSON.parse(texto);
    expect(parsed.aplicacao).toBe(BACKUP_APLICACAO);
    expect(parsed.versao).toBe(2);
    expect(parsed.geradoEm).toBe("2024-05-05T00:00:00.000Z");
    expect(parsed.estado.agentes).toHaveLength(5);
  });

  it("reimporta o próprio backup sem perdas", () => {
    const original = createSeedState();
    const r = parseBackup(serializarBackup(original));
    expect(r.state).not.toBeNull();
    expect(r.meta?.versao).toBe(2);
    expect(r.state!.agentes.length).toBe(original.agentes.length);
    expect(r.state!.missoes.length).toBe(original.missoes.length);
  });

  it("rejeita JSON inválido sem lançar", () => {
    const r = parseBackup("{ isto não é json }");
    expect(r.state).toBeNull();
    expect(r.issues[0].mensagem).toMatch(/JSON válido/);
    expect(r.meta).toBeNull();
  });

  it("aceita um estado cru (sem envelope) por compatibilidade", () => {
    const r = parseBackup(JSON.stringify(createSeedState()));
    expect(r.state).not.toBeNull();
    expect(r.meta).toBeNull();
  });

  it("aplica a validação mesmo dentro do envelope (integração ativa rebaixada)", () => {
    const comTrapaca = createSeedState();
    comTrapaca.integracoes = comTrapaca.integracoes.map((i) =>
      i.id === "trae" ? { ...i, estado: "ativa" as const, ultimaVerificacao: null } : i
    );
    const r = parseBackup(serializarBackup(comTrapaca));
    expect(r.state!.integracoes.find((i) => i.id === "trae")!.estado).toBe("desativada");
  });

  it("rejeita backup sem as coleções obrigatórias", () => {
    const r = parseBackup(JSON.stringify({ estado: { agentes: [] } }));
    expect(r.state).toBeNull();
  });
});
