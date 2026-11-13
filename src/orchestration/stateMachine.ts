// Máquina de estados das execuções de missão.
//
// Define explicitamente quais transições são permitidas. Qualquer transição fora
// desta tabela é rejeitada pelo motor — isso evita estados impossíveis (por
// exemplo, "concluída" voltando para "executando" sem nova tentativa).

import type { RunStatus } from "./types";

export const ESTADOS_TERMINAIS: RunStatus[] = ["concluida", "falhou", "cancelada", "expirada"];

const TRANSICOES: Record<RunStatus, RunStatus[]> = {
  enfileirada: ["aguardando_dependencia", "aguardando_aprovacao", "executando", "cancelada"],
  aguardando_dependencia: ["enfileirada", "aguardando_aprovacao", "executando", "cancelada"],
  aguardando_aprovacao: ["enfileirada", "executando", "cancelada"],
  executando: ["enfileirada", "concluida", "falhou", "expirada", "cancelada", "aguardando_aprovacao"],
  concluida: [],
  falhou: [],
  cancelada: [],
  expirada: [],
};

export function ehTerminal(status: RunStatus): boolean {
  return ESTADOS_TERMINAIS.includes(status);
}

export function podeTransicionar(de: RunStatus, para: RunStatus): boolean {
  if (de === para) return true;
  return TRANSICOES[de].includes(para);
}

export function transicoesPermitidas(de: RunStatus): RunStatus[] {
  return [...TRANSICOES[de]];
}
