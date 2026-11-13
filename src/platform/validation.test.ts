import { describe, expect, it } from "vitest";
import {
  detectarSegredos,
  garantirSemSegredos,
  sanitizarTexto,
  validarEmail,
  validarIntervalo,
  validarMissao,
  validarNome,
  varrerSegredos,
} from "./validation";

describe("validation — detecção de segredos", () => {
  it("detecta chave OpenAI, Bearer, AWS, chave privada, api_key e JWT", () => {
    expect(detectarSegredos("sk-abcdefghijklmnop123456").contem).toBe(true);
    expect(detectarSegredos("Authorization: Bearer abcdef0123456789").contem).toBe(true);
    expect(detectarSegredos("AKIAIOSFODNN7EXAMPLE").contem).toBe(true);
    expect(detectarSegredos("-----BEGIN RSA PRIVATE KEY-----").contem).toBe(true);
    expect(detectarSegredos('api_key = "segredo-muito-longo"').contem).toBe(true);
    expect(
      detectarSegredos("eyJabcdefghij.eyJklmnopqrs.eyJtuvwxyz0").contem
    ).toBe(true);
  });

  it("não marca texto comum como segredo", () => {
    const r = detectarSegredos("Relatório de testes aprovados com 67 casos.");
    expect(r.contem).toBe(false);
    expect(r.motivos).toHaveLength(0);
  });

  it("varrerSegredos aponta o caminho do segredo em estruturas aninhadas", () => {
    const achados = varrerSegredos({
      ok: "texto normal",
      config: { senha: "password: super-secreto-123" },
      lista: ["sk-abcdefghijklmnop123456"],
    });
    expect(achados).toContain("raiz.config.senha");
    expect(achados).toContain("raiz.lista[0]");
  });

  it("garantirSemSegredos lança quando há segredo e não lança quando limpo", () => {
    expect(() => garantirSemSegredos({ token: "sk-abcdefghijklmnop123456" })).toThrow(/segredo/i);
    expect(() => garantirSemSegredos({ token: "valor-normal" })).not.toThrow();
  });
});

describe("validation — sanitização e campos", () => {
  it("sanitizarTexto remove caracteres de controle e limita o tamanho", () => {
    expect(sanitizarTexto("  oi\u0000 mundo  ")).toBe("oi mundo");
    expect(sanitizarTexto("abcdef", 3)).toBe("abc");
    expect(sanitizarTexto(123)).toBe("");
  });

  it("validarNome exige comprimento mínimo e rejeita credenciais", () => {
    expect(validarNome("x").valido).toBe(false);
    expect(validarNome("sk-abcdefghijklmnop123456").valido).toBe(false);
    expect(validarNome("Missão Válida").valido).toBe(true);
  });

  it("validarEmail valida formato", () => {
    expect(validarEmail("operador@exemplo.invalid").valido).toBe(true);
    expect(validarEmail("sem-arroba").valido).toBe(false);
  });

  it("validarIntervalo valida faixa numérica", () => {
    expect(validarIntervalo(5, 0, 10).valido).toBe(true);
    expect(validarIntervalo(11, 0, 10).valido).toBe(false);
    expect(validarIntervalo("abc", 0, 10).valido).toBe(false);
  });

  it("validarMissao rejeita segredos em objetivo/instruções", () => {
    expect(validarMissao({ titulo: "Missão de teste" }).valido).toBe(true);
    expect(validarMissao({ titulo: "ab" }).valido).toBe(false);
    expect(
      validarMissao({ titulo: "Missão válida", instrucoes: "use sk-abcdefghijklmnop123456" }).valido
    ).toBe(false);
  });
});
