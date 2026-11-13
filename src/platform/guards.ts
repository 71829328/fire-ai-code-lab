// Guardas de segurança e controle de custos.
//
// Todas as operações externas (chamadas a provedores de IA, deploy, gastos) ficam
// BLOQUEADAS por padrão. Só podem ser liberadas por autorização explícita do
// proprietário, e mesmo assim registradas em auditoria.

import type { MissionRun } from "../orchestration/types";
import type { Criticidade } from "./types";

export interface LimitesOperacao {
  maxConcorrentes: number;
  maxExecucoesPorMissao: number;
  maxTentativas: number;
  timeoutMs: number;
  // Nunca habilitado nesta entrega: exige autorização real e auditoria.
  operacoesExternasPermitidas: boolean;
  gastoPermitido: boolean;
}

export const LIMITES_PADRAO: LimitesOperacao = {
  maxConcorrentes: 3,
  maxExecucoesPorMissao: 5,
  maxTentativas: 3,
  timeoutMs: 30_000,
  operacoesExternasPermitidas: false,
  gastoPermitido: false,
};

export interface GuardaResultado {
  permitido: boolean;
  motivo: string;
}

// Bloqueio de operações externas: por padrão, sempre negado.
export function permitirOperacaoExterna(
  limites: LimitesOperacao = LIMITES_PADRAO,
  autorizacaoExplicita = false
): GuardaResultado {
  if (autorizacaoExplicita && limites.operacoesExternasPermitidas) {
    return { permitido: true, motivo: "Operação externa autorizada explicitamente." };
  }
  return {
    permitido: false,
    motivo:
      "Operação externa bloqueada: exige autorização real validada do proprietário. Use o fluxo manual assistido.",
  };
}

export function permitirGasto(limites: LimitesOperacao = LIMITES_PADRAO): GuardaResultado {
  if (limites.gastoPermitido) return { permitido: true, motivo: "Gasto autorizado." };
  return { permitido: false, motivo: "Operações com custo estão bloqueadas nesta configuração." };
}

// Verifica os limites de execução antes de enfileirar/rodar.
export function verificarLimitesExecucao(
  runs: MissionRun[],
  missaoId: string,
  limites: LimitesOperacao = LIMITES_PADRAO
): GuardaResultado {
  const ativos = runs.filter((r) => r.status === "executando" || r.status === "enfileirada");
  if (ativos.length >= limites.maxConcorrentes * 10) {
    return { permitido: false, motivo: "Fila de execução acima do limite seguro." };
  }
  const daMissao = runs.filter((r) => r.missaoId === missaoId);
  if (daMissao.length >= limites.maxExecucoesPorMissao) {
    return { permitido: false, motivo: `Limite de ${limites.maxExecucoesPorMissao} execuções por missão atingido.` };
  }
  return { permitido: true, motivo: "Dentro dos limites." };
}

/* ------------------------------------------------------------------ */
/* Política de aprovação humana                                        */
/* ------------------------------------------------------------------ */

export type TipoOperacao =
  | "execucao_local"
  | "execucao_externa"
  | "deploy"
  | "exclusao_massa"
  | "alteracao_seguranca";

const OPERACOES_CRITICAS: TipoOperacao[] = [
  "execucao_externa",
  "deploy",
  "exclusao_massa",
  "alteracao_seguranca",
];

export function exigirAprovacaoHumana(operacao: TipoOperacao): boolean {
  return OPERACOES_CRITICAS.includes(operacao);
}

export function criticidadeDaOperacao(operacao: TipoOperacao): Criticidade {
  return exigirAprovacaoHumana(operacao) ? "critica" : "normal";
}

/* ------------------------------------------------------------------ */
/* Limites de custo                                                    */
/* ------------------------------------------------------------------ */

// Estimativa apenas INFORMATIVA: nunca calcula preço real de API paga.
export function estimarCustoExcedido(
  custoAcumulado: number,
  teto: number
): GuardaResultado {
  if (!Number.isFinite(teto) || teto <= 0) {
    return { permitido: false, motivo: "Sem teto de custo definido: consumo externo permanece bloqueado." };
  }
  if (custoAcumulado >= teto) {
    return { permitido: false, motivo: `Teto de custo atingido (${teto}).` };
  }
  return { permitido: true, motivo: "Dentro do teto informado." };
}
