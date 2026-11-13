// Recomendação de agentes (LAB-003).
//
// Regra central: só pontuamos com dados observados (taxa de sucesso, testes
// aprovados, retrabalho e tempo médio). Um agente sem nenhuma execução recebe
// pontuação 0 e confiança "sem_dados" — jamais inventamos desempenho.

import type { MissionRun, MissionView } from "../orchestration/types";
import type { EvidenceRecord, UsageMetric } from "../platform/types";
import { calcularMetricasAgente } from "./metrics";

export interface AgenteRecomendavel {
  id: string;
  nome: string;
  papel: string;
  conexao: "desconectado" | "verificado";
}

export interface RecomendarAgentesParams {
  agentes: AgenteRecomendavel[];
  runs: MissionRun[];
  evidencias: EvidenceRecord[];
  consumo: UsageMetric[];
  missao?: MissionView;
}

export interface Recomendacao {
  agenteId: string;
  nome: string;
  pontuacao: number;
  justificativa: string;
  confianca: "alta" | "media" | "baixa" | "sem_dados";
}

// Confiança derivada apenas do tamanho da amostra observada (nº de runs).
function confiancaPorAmostra(totalRuns: number): Recomendacao["confianca"] {
  if (totalRuns === 0) return "sem_dados";
  if (totalRuns >= 5) return "alta";
  if (totalRuns >= 2) return "media";
  return "baixa";
}

// Pontuação 0-~100 somando somente evidências observáveis:
//   - taxa de sucesso (peso principal, até +60);
//   - testes aprovados (até +20);
//   - retrabalho penaliza (até -20);
//   - tempo médio mais curto bonifica (até +20).
function calcularPontuacao(metricas: ReturnType<typeof calcularMetricasAgente>): number {
  let pontuacao = 0;
  pontuacao += (metricas.taxaSucesso ?? 0) * 60;
  pontuacao += Math.min(metricas.testesAprovados, 4) * 5;
  pontuacao -= Math.min(metricas.retrabalho, 4) * 5;
  if (metricas.tempoMedioMs !== null) {
    const minutos = metricas.tempoMedioMs / 60_000;
    pontuacao += Math.max(0, 20 - minutos * 2);
  }
  return Math.max(0, Math.round(pontuacao * 100) / 100);
}

export function recomendarAgentes(params: RecomendarAgentesParams): Recomendacao[] {
  const recomendacoes: Recomendacao[] = params.agentes.map((agente) => {
    const runsDoAgente = params.runs.filter((r) => r.agenteId === agente.id);

    if (runsDoAgente.length === 0) {
      // Sem nenhuma execução observada: não fabricamos desempenho.
      return {
        agenteId: agente.id,
        nome: agente.nome,
        pontuacao: 0,
        justificativa: "Sem execuções registradas",
        confianca: "sem_dados" as const,
      };
    }

    const metricas = calcularMetricasAgente({
      agenteId: agente.id,
      runs: params.runs,
      evidencias: params.evidencias,
      consumo: params.consumo,
    });

    const partes: string[] = [`${metricas.missoesConcluidas} concluída(s)`];
    if (metricas.taxaSucesso !== null) {
      partes.push(`${Math.round(metricas.taxaSucesso * 100)}% sucesso`);
    }
    partes.push(`${metricas.retrabalho} retrabalho`);
    if (metricas.testesAprovados > 0) {
      partes.push(`${metricas.testesAprovados} teste(s) aprovado(s)`);
    }

    return {
      agenteId: agente.id,
      nome: agente.nome,
      pontuacao: calcularPontuacao(metricas),
      justificativa: partes.join("; "),
      confianca: confiancaPorAmostra(runsDoAgente.length),
    };
  });

  return recomendacoes.sort(
    (a, b) => b.pontuacao - a.pontuacao || a.nome.localeCompare(b.nome)
  );
}

// Retorna a melhor recomendação com pontuação real (> 0); null quando todas são
// "sem_dados" (ou seja, não há base para recomendar ninguém).
export function melhorRecomendacao(params: RecomendarAgentesParams): Recomendacao | null {
  return recomendarAgentes(params).find((r) => r.pontuacao > 0) ?? null;
}
