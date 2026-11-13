import { describe, expect, it } from "vitest";
import { runLocalDemoTask } from "./localExecutor";

describe("localExecutor — execução local de demonstração", () => {
  it("calcula métricas corretas do texto", () => {
    const r = runLocalDemoTask({ texto: "um dois três" });
    expect(r.saida.caracteres).toBe(12);
    expect(r.saida.palavras).toBe(3);
    expect(r.saida.linhas).toBe(1);
  });

  it("conta linhas corretamente", () => {
    const r = runLocalDemoTask({ texto: "a\nb\nc" });
    expect(r.saida.linhas).toBe(3);
    expect(r.saida.palavras).toBe(3);
  });

  it("trata entrada vazia sem quebrar", () => {
    const r = runLocalDemoTask({ texto: "" });
    expect(r.saida.palavras).toBe(0);
    expect(r.saida.linhas).toBe(0);
    expect(r.checksum).toMatch(/^fnv1a-[0-9a-f]{8}$/);
  });

  it("rotula explicitamente a execução como LOCAL, não como IA", () => {
    const r = runLocalDemoTask({ texto: "abc" });
    expect(r.modo).toBe("local");
  });

  it("produz checksum determinístico para a mesma entrada", () => {
    const a = runLocalDemoTask({ texto: "conteúdo estável" });
    const b = runLocalDemoTask({ texto: "conteúdo estável" });
    expect(a.checksum).toBe(b.checksum);
  });

  it("produz checksum diferente para entradas diferentes", () => {
    const a = runLocalDemoTask({ texto: "um" });
    const b = runLocalDemoTask({ texto: "dois" });
    expect(a.checksum).not.toBe(b.checksum);
  });

  it("aprova a verificação independente (passou = true)", () => {
    const r = runLocalDemoTask({ texto: "verificar consistência interna" });
    expect(r.verificacao.passou).toBe(true);
    expect(r.verificacao.detalhe).toMatch(/reconferido/);
  });

  it("considera os critérios de aceite informados no resumo", () => {
    const r = runLocalDemoTask({ texto: "x", criterios: ["c1", "c2", "   "] });
    expect(r.saida.resumo).toMatch(/2 critério/);
    expect(r.missaoId).toBeNull();
  });

  it("associa a execução à missão quando informada", () => {
    const r = runLocalDemoTask({ texto: "x", missaoId: "ms-001" });
    expect(r.missaoId).toBe("ms-001");
  });
});
