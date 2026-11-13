import { describe, expect, it } from "vitest";
import {
  capacidadeOAuth,
  criarSessao,
  gerarHashSenha,
  SESSION_TTL_MS,
  validarSessao,
  verificarSenha,
} from "./auth";

const SEGREDO = "segredo-de-teste-nao-usar-em-producao";

const BASE = {
  sub: "us-1",
  org: "org-demo",
  papel: "operador" as const,
  nome: "Analista",
  email: "operacao@exemplo.invalid",
};

describe("sessão assinada (HMAC-SHA256)", () => {
  it("emite e valida um token íntegro", () => {
    const token = criarSessao(BASE, SEGREDO);
    expect(token.startsWith("v1.")).toBe(true);
    const resultado = validarSessao(token, SEGREDO);
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.payload.sub).toBe("us-1");
      expect(resultado.payload.org).toBe("org-demo");
      expect(resultado.payload.papel).toBe("operador");
      expect(resultado.payload.exp - resultado.payload.iat).toBe(SESSION_TTL_MS);
    }
  });

  it("não emite sessão sem segredo configurado", () => {
    expect(() => criarSessao(BASE, null)).toThrow(/Segredo de sessão não configurado/);
  });

  it("rejeita validação quando o segredo está ausente", () => {
    const token = criarSessao(BASE, SEGREDO);
    expect(validarSessao(token, null)).toEqual({ ok: false, motivo: "segredo_ausente" });
  });

  it("rejeita token ausente", () => {
    expect(validarSessao(null, SEGREDO)).toEqual({ ok: false, motivo: "ausente" });
  });

  it("rejeita formato inválido", () => {
    expect(validarSessao("nao-e-token", SEGREDO)).toEqual({ ok: false, motivo: "formato_invalido" });
    expect(validarSessao("v2.aaa.bbb", SEGREDO)).toEqual({ ok: false, motivo: "formato_invalido" });
  });

  it("detecta assinatura adulterada", () => {
    const token = criarSessao(BASE, SEGREDO);
    const [versao, corpo] = token.split(".");
    const forjado = `${versao}.${corpo}.assinaturaForjada`;
    expect(validarSessao(forjado, SEGREDO)).toEqual({ ok: false, motivo: "assinatura_invalida" });
  });

  it("detecta payload adulterado que preserva a assinatura antiga", () => {
    const token = criarSessao(BASE, SEGREDO);
    const partes = token.split(".");
    const payloadAdulterado = Buffer.from(JSON.stringify({ ...BASE, exp: Date.now() + 1e9, iat: 0, jti: "x" })).toString("base64url");
    const forjado = `${partes[0]}.${payloadAdulterado}.${partes[2]}`;
    expect(validarSessao(forjado, SEGREDO)).toEqual({ ok: false, motivo: "assinatura_invalida" });
  });

  it("rejeita token assinado com outro segredo (não aceita identidade de outro emissor)", () => {
    const token = criarSessao(BASE, "outro-segredo");
    expect(validarSessao(token, SEGREDO).ok).toBe(false);
  });

  it("rejeita token expirado", () => {
    const agora = 1_700_000_000_000;
    const token = criarSessao({ ...BASE, agoraMs: agora, ttlMs: 1000 }, SEGREDO);
    const resultado = validarSessao(token, SEGREDO, agora + 5000);
    expect(resultado).toEqual({ ok: false, motivo: "expirada" });
  });
});

describe("senhas (scrypt)", () => {
  it("gera hash verificável e rejeita senha incorreta", () => {
    const hash = gerarHashSenha("fire-demo-2026");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verificarSenha("fire-demo-2026", hash)).toBe(true);
    expect(verificarSenha("outra-senha", hash)).toBe(false);
  });

  it("usa salt distinto por hash (mesma senha ⇒ hashes diferentes)", () => {
    expect(gerarHashSenha("abc123456")).not.toBe(gerarHashSenha("abc123456"));
  });

  it("rejeita hash malformado sem lançar", () => {
    expect(verificarSenha("x", "nao-e-hash")).toBe(false);
    expect(verificarSenha("x", "scrypt$1$2$3$zzz")).toBe(false);
    expect(verificarSenha("x", "")).toBe(false);
  });
});

describe("capacidade OAuth (honesta)", () => {
  it("sem client-id, permanece não configurado e nunca conectado", () => {
    const cap = capacidadeOAuth("google", {});
    expect(cap.configurado).toBe(false);
    expect(cap.autorizacaoConectada).toBe(false);
  });

  it("com client-id, ainda não declara autorização conectada", () => {
    const cap = capacidadeOAuth("microsoft", { microsoftClientId: "client-123" });
    expect(cap.configurado).toBe(true);
    expect(cap.autorizacaoConectada).toBe(false);
    expect(cap.observacao).toMatch(/não conectado/i);
  });
});
