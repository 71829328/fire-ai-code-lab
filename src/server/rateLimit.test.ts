import { describe, expect, it } from "vitest";
import { chaveDeRateLimit, Limitador, LIMITE_AUTENTICACAO, LIMITE_PADRAO } from "./rateLimit";

function relogioControlado(inicio = 1_000_000) {
  let agora = inicio;
  return {
    agora: () => agora,
    avancar: (ms: number) => {
      agora += ms;
    },
  };
}

describe("rate limiting (janela deslizante)", () => {
  it("permite até o limite e então bloqueia", () => {
    const relogio = relogioControlado();
    const limitador = new Limitador({ janelaMs: 60_000, maxRequisicoes: 3 }, relogio.agora);
    expect(limitador.verificar("k").permitido).toBe(true);
    expect(limitador.verificar("k").permitido).toBe(true);
    expect(limitador.verificar("k").permitido).toBe(true);
    const quarta = limitador.verificar("k");
    expect(quarta.permitido).toBe(false);
    expect(quarta.restantes).toBe(0);
    expect(quarta.redefinirEmMs).toBeGreaterThan(0);
  });

  it("chaves distintas não compartilham cota", () => {
    const limitador = new Limitador({ janelaMs: 60_000, maxRequisicoes: 1 });
    expect(limitador.verificar("a").permitido).toBe(true);
    expect(limitador.verificar("a").permitido).toBe(false);
    expect(limitador.verificar("b").permitido).toBe(true);
  });

  it("libera novamente quando a janela desliza", () => {
    const relogio = relogioControlado();
    const limitador = new Limitador({ janelaMs: 1000, maxRequisicoes: 1 }, relogio.agora);
    expect(limitador.verificar("k").permitido).toBe(true);
    expect(limitador.verificar("k").permitido).toBe(false);
    relogio.avancar(1001);
    expect(limitador.verificar("k").permitido).toBe(true);
  });

  it("limpar descarta marcas antigas", () => {
    const relogio = relogioControlado();
    const limitador = new Limitador({ janelaMs: 1000, maxRequisicoes: 1 }, relogio.agora);
    limitador.verificar("k");
    expect(limitador.tamanho()).toBe(1);
    relogio.avancar(5000);
    limitador.limpar();
    expect(limitador.tamanho()).toBe(0);
  });

  it("a cota de autenticação é mais rígida que a cota padrão", () => {
    expect(LIMITE_AUTENTICACAO.maxRequisicoes).toBeLessThan(LIMITE_PADRAO.maxRequisicoes);
  });

  it("a chave combina origem e rota, com fallback para origem desconhecida", () => {
    expect(chaveDeRateLimit("1.2.3.4", "login")).toBe("1.2.3.4::login");
    expect(chaveDeRateLimit("", "login")).toBe("desconhecido::login");
  });
});
