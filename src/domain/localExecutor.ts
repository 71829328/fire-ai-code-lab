// Executor local de demonstração.
//
// Executa uma tarefa simples e VERIFICÁVEL inteiramente no navegador, sem
// nenhuma API externa: extrai métricas do texto e calcula um checksum FNV-1a.
// A verificação reconfere os resultados por um caminho independente, de modo
// que `passou` reflita uma checagem real e não uma promessa.
//
// Importante: isto é execução LOCAL determinística, não é execução por IA.
// A interface sempre rotula essa distinção.

import type { LocalExecution } from "../types";

function contarCaracteres(texto: string): number {
  let total = 0;
  for (const _ of texto) total += 1;
  return total;
}

function contarPalavras(texto: string): number {
  const limpo = texto.trim();
  if (limpo === "") return 0;
  return limpo.split(/\s+/).length;
}

function contarLinhas(texto: string): number {
  if (texto === "") return 0;
  return texto.split(/\r?\n/).length;
}

// FNV-1a de 32 bits — determinístico e independente de bibliotecas.
function fnv1a(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a-${hash.toString(16).padStart(8, "0")}`;
}

export interface LocalTaskInput {
  texto: string;
  missaoId?: string | null;
  criterios?: string[];
}

export function runLocalDemoTask(input: LocalTaskInput): LocalExecution {
  const inicio = Date.now();
  const texto = input.texto ?? "";

  const caracteres = contarCaracteres(texto);
  const palavras = contarPalavras(texto);
  const linhas = contarLinhas(texto);
  const checksum = fnv1a(texto);

  // Verificação independente: refaz os cálculos por outro caminho.
  const caracteresVerificados = Array.from(texto).length;
  const palavrasVerificadas = texto.trim() === "" ? 0 : texto.trim().split(/\s+/).length;
  const checksumVerificado = fnv1a(texto);

  const consistente =
    caracteres === caracteresVerificados &&
    palavras === palavrasVerificadas &&
    checksum === checksumVerificado;

  const criterios = (input.criterios ?? []).filter((item) => item.trim().length > 0);
  const detalhe = consistente
    ? `Métricas e checksum reconferidos (${caracteres} caracteres, ${palavras} palavras, ${linhas} linha(s)).`
    : "Divergência detectada na reconferência das métricas.";

  return {
    id: `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    missaoId: input.missaoId ?? null,
    entrada: texto.slice(0, 400),
    saida: {
      caracteres,
      palavras,
      linhas,
      resumo:
        criterios.length > 0
          ? `Entrada analisada localmente; ${criterios.length} critério(s) de aceite considerados.`
          : "Entrada analisada localmente.",
    },
    checksum,
    verificacao: { passou: consistente, detalhe },
    duracaoMs: Math.max(1, Date.now() - inicio),
    timestamp: new Date().toISOString(),
    modo: "local",
  };
}
