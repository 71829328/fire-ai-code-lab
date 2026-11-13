// =====================================================================
// FIRE Agent Command Center — LAB-004
// Preferências server-side de ativação de provedores (kill switch honesto).
//
// "Desativar" é uma decisão do OPERADOR aplicada no SERVIDOR. Um provedor
// desativado não é consultado (nenhuma chamada de rede) e aparece como
// "indisponível" na Central de Conexões — nunca como conectado.
//
// LIMITAÇÃO DECLARADA: sem banco configurado, este estado vive na instância do
// processo. Ao reciclar a função serverless, as preferências voltam ao padrão
// (todos ativos). Nada é gravado no navegador. Com Supabase configurado, a
// preferência pode ser persistida em `app.preferencias_provedor`.
// =====================================================================

export class PreferenciasProvedores {
  private readonly desativados = new Set<string>();

  desativar(id: string): void {
    this.desativados.add(id);
  }

  ativar(id: string): void {
    this.desativados.delete(id);
  }

  estaDesativado(id: string): boolean {
    return this.desativados.has(id);
  }

  /** Ids desativados, ordenados — determinístico para testes e respostas. */
  listar(): string[] {
    return [...this.desativados].sort();
  }

  limpar(): void {
    this.desativados.clear();
  }
}
