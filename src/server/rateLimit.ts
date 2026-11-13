// =====================================================================
// FIRE Agent Command Center — LAB-004
// Rate limiting server-side (janela deslizante, em memória).
//
// Objetivo: proteger contra abuso e força bruta sem depender de infra paga.
// A chave combina origem (IP) e rota. Em ambiente multi-instância o limite é
// por instância — o suficiente como primeira linha de defesa; o endurecimento
// definitivo exige um contador compartilhado (documentado em docs/LAB-004).
// =====================================================================

export interface LimiteConfig {
  janelaMs: number;
  maxRequisicoes: number;
}

export const LIMITE_PADRAO: LimiteConfig = { janelaMs: 60_000, maxRequisicoes: 60 };
/** Limites mais rígidos para rotas sensíveis (login). */
export const LIMITE_AUTENTICACAO: LimiteConfig = { janelaMs: 60_000, maxRequisicoes: 10 };

export interface ResultadoLimite {
  permitido: boolean;
  restantes: number;
  redefinirEmMs: number;
}

export class Limitador {
  private readonly marcas = new Map<string, number[]>();
  private readonly config: LimiteConfig;
  private readonly relogio: () => number;

  constructor(config: LimiteConfig = LIMITE_PADRAO, relogio: () => number = () => Date.now()) {
    this.config = config;
    this.relogio = relogio;
  }

  verificar(chave: string): ResultadoLimite {
    const agora = this.relogio();
    const inicio = agora - this.config.janelaMs;
    const historico = (this.marcas.get(chave) ?? []).filter((t) => t > inicio);

    if (historico.length >= this.config.maxRequisicoes) {
      const maisAntigo = historico[0];
      const redefinirEmMs = Math.max(0, maisAntigo + this.config.janelaMs - agora);
      this.marcas.set(chave, historico);
      return { permitido: false, restantes: 0, redefinirEmMs };
    }

    historico.push(agora);
    this.marcas.set(chave, historico);
    return {
      permitido: true,
      restantes: this.config.maxRequisicoes - historico.length,
      redefinirEmMs: 0,
    };
  }

  /** Remove entradas antigas — chamado periodicamente para conter memória. */
  limpar(): void {
    const inicio = this.relogio() - this.config.janelaMs;
    for (const [chave, marcas] of this.marcas) {
      const ativas = marcas.filter((t) => t > inicio);
      if (ativas.length === 0) this.marcas.delete(chave);
      else this.marcas.set(chave, ativas);
    }
  }

  tamanho(): number {
    return this.marcas.size;
  }
}

export function chaveDeRateLimit(ip: string, rota: string): string {
  return `${ip || "desconhecido"}::${rota}`;
}
