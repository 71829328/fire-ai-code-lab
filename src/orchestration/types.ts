// Tipos do motor de orquestração de missões.
//
// O motor é puro e determinístico: recebe um estado de execuções, um conjunto de
// missões e uma configuração, e devolve o próximo estado. Nada aqui chama rede.

import type { Priority, MissionStatus } from "../types";

export type RunStatus =
  | "enfileirada" // aguardando vaga na fila
  | "aguardando_dependencia" // dependências ainda não concluídas
  | "aguardando_aprovacao" // operação crítica travada por aprovação humana
  | "executando"
  | "concluida"
  | "falhou"
  | "cancelada"
  | "expirada"; // estourou o timeout

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  enfileirada: "Enfileirada",
  aguardando_dependencia: "Aguardando dependência",
  aguardando_aprovacao: "Aguardando aprovação",
  executando: "Executando",
  concluida: "Concluída",
  falhou: "Falhou",
  cancelada: "Cancelada",
  expirada: "Expirada",
};

export type RunResultado = {
  resumo: string;
  checksum: string;
  verificacao: { passou: boolean; detalhe: string };
};

export interface RunAttempt {
  numero: number;
  inicio: string;
  fim: string | null;
  status: "executando" | "sucesso" | "falha" | "timeout";
  erro: string | null;
  resultado: RunResultado | null;
}

export interface RunEvento {
  id: string;
  status: RunStatus;
  descricao: string;
  timestamp: string;
}

export interface MissionRun {
  id: string;
  organizacaoId: string;
  missaoId: string;
  missaoCodigo: string;
  agenteId: string | null;
  prioridade: Priority;
  criticidade: "normal" | "critica";
  status: RunStatus;
  chaveIdempotencia: string;
  tentativaAtual: number;
  tentativas: RunAttempt[];
  eventos: RunEvento[];
  criadoEm: string;
  atualizadoEm: string;
  // Momento em que a execução corrente começou (para medir timeout/concorrência).
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  // Resultado final consolidado (quando concluída).
  resultado: RunResultado | null;
  erro: string | null;
}

export interface EngineConfig {
  maxConcorrencia: number;
  timeoutMs: number;
  maxTentativas: number;
  retentativaBaseMs: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  maxConcorrencia: 3,
  timeoutMs: 30_000,
  maxTentativas: 3,
  retentativaBaseMs: 500,
};

// Projeção mínima de uma missão exigida pelo motor. Mantém o motor desacoplado
// do modelo completo de domínio.
export interface MissionView {
  id: string;
  codigo: string;
  titulo: string;
  prioridade: Priority;
  status: MissionStatus;
  dependencias: string[];
  agenteId: string | null;
  instrucoes: string;
  criteriosAceite: string[];
}

export interface QueueEntry {
  runId: string;
  missaoCodigo: string;
  prioridade: Priority;
  status: RunStatus;
  aguardando: string | null;
}

// Resultado de uma etapa do motor: novo estado + eventos colaterais, para que a
// camada de apresentação possa auditar sem que o motor conheça a UI.
export interface EngineStepResult {
  runs: MissionRun[];
  iniciados: string[];
  concluidos: string[];
  expirados: string[];
  mensagens: string[];
}

export const PRIORITY_WEIGHT: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
