// Motor de orquestração de missões.
//
// Funções puras: recebem o estado das execuções e devolvem um novo estado. O
// motor decide o que pode rodar agora respeitando prioridade, dependências,
// concorrência, timeout, retentativas e aprovação humana de operações críticas.
//
// A execução propriamente dita é delegada ao chamador (ver localRunner.ts), o que
// mantém o motor determinístico e testável.

import type { Mission } from "../types";
import {
  DEFAULT_ENGINE_CONFIG,
  PRIORITY_WEIGHT,
  type EngineConfig,
  type EngineStepResult,
  type MissionRun,
  type MissionView,
  type QueueEntry,
  type RunResultado,
  type RunStatus,
} from "./types";
import { ehTerminal, podeTransicionar } from "./stateMachine";

let contador = 0;
function novoId(prefixo: string): string {
  contador += 1;
  const aleatorio =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefixo}-${aleatorio}-${contador}`;
}

export function missionParaView(missao: Mission): MissionView {
  return {
    id: missao.id,
    codigo: missao.codigo,
    titulo: missao.titulo,
    prioridade: missao.prioridade,
    status: missao.status,
    dependencias: missao.dependencias,
    agenteId: missao.agenteId,
    instrucoes: missao.instrucoes,
    criteriosAceite: missao.criteriosAceite,
  };
}

/* ------------------------------------------------------------------ */
/* Criação e enfileiramento (com idempotência)                         */
/* ------------------------------------------------------------------ */

export interface CriarRunParams {
  organizacaoId: string;
  missao: MissionView;
  agenteId?: string | null;
  criticidade?: "normal" | "critica";
  chaveIdempotencia?: string;
  agora?: string;
  id?: string;
}

export function criarRun(params: CriarRunParams): MissionRun {
  const agora = params.agora ?? new Date().toISOString();
  const id = params.id ?? novoId("run");
  return {
    id,
    organizacaoId: params.organizacaoId,
    missaoId: params.missao.id,
    missaoCodigo: params.missao.codigo,
    agenteId: params.agenteId ?? params.missao.agenteId ?? null,
    prioridade: params.missao.prioridade,
    criticidade: params.criticidade ?? "normal",
    status: "enfileirada",
    chaveIdempotencia: params.chaveIdempotencia ?? `${params.organizacaoId}:${params.missao.id}`,
    tentativaAtual: 0,
    tentativas: [],
    eventos: [
      { id: novoId("ev"), status: "enfileirada", descricao: "Execução enfileirada", timestamp: agora },
    ],
    criadoEm: agora,
    atualizadoEm: agora,
    iniciadoEm: null,
    finalizadoEm: null,
    resultado: null,
    erro: null,
  };
}

// Enfileira respeitando idempotência: se já existir uma execução não terminal com
// a mesma chave, nada é criado.
export function enfileirar(
  runs: MissionRun[],
  novo: MissionRun
): { runs: MissionRun[]; criado: boolean; existenteId: string | null } {
  const existente = runs.find(
    (r) => r.chaveIdempotencia === novo.chaveIdempotencia && !ehTerminal(r.status)
  );
  if (existente) return { runs, criado: false, existenteId: existente.id };
  return { runs: [novo, ...runs], criado: true, existenteId: null };
}

/* ------------------------------------------------------------------ */
/* Consultas                                                           */
/* ------------------------------------------------------------------ */

export function ehAtivo(status: RunStatus): boolean {
  return !ehTerminal(status);
}

// Fila de espera ordenada por prioridade (alta primeiro) e, em empate, por
// ordem de criação (mais antiga primeiro) — garante justiça e determinismo.
export function filaOrdenada(runs: MissionRun[]): MissionRun[] {
  return runs
    .filter((r) => r.status === "enfileirada" || r.status === "aguardando_dependencia")
    .slice()
    .sort((a, b) => {
      const peso = PRIORITY_WEIGHT[a.prioridade] - PRIORITY_WEIGHT[b.prioridade];
      if (peso !== 0) return peso;
      return a.criadoEm.localeCompare(b.criadoEm);
    });
}

export function dependenciasSatisfeitas(run: MissionRun, missoes: MissionView[]): boolean {
  const missao = missoes.find((m) => m.id === run.missaoId);
  if (!missao) return true;
  return missao.dependencias.every(
    (depId) => missoes.find((m) => m.id === depId)?.status === "concluida"
  );
}

export function resumoFila(runs: MissionRun[]): QueueEntry[] {
  return filaOrdenada(runs).map((r) => ({
    runId: r.id,
    missaoCodigo: r.missaoCodigo,
    prioridade: r.prioridade,
    status: r.status,
    aguardando: r.status === "aguardando_dependencia" ? "dependências" : null,
  }));
}

export function emExecucao(runs: MissionRun[]): MissionRun[] {
  return runs.filter((r) => r.status === "executando");
}

/* ------------------------------------------------------------------ */
/* Transições internas                                                 */
/* ------------------------------------------------------------------ */

function transicionar(
  run: MissionRun,
  para: RunStatus,
  descricao: string,
  agora: string,
  extras: Partial<MissionRun> = {}
): MissionRun {
  if (!podeTransicionar(run.status, para)) {
    throw new Error(`Transição inválida: ${run.status} → ${para}`);
  }
  return {
    ...run,
    ...extras,
    status: para,
    atualizadoEm: agora,
    eventos: [
      ...run.eventos,
      { id: novoId("ev"), status: para, descricao, timestamp: agora },
    ],
  };
}

// Abre uma nova tentativa e coloca a execução em "executando".
export function iniciar(run: MissionRun, agora: string): MissionRun {
  const numero = run.tentativas.length + 1;
  const attempt = {
    numero,
    inicio: agora,
    fim: null,
    status: "executando" as const,
    erro: null,
    resultado: null,
  };
  return transicionar(run, "executando", `Tentativa ${numero} iniciada`, agora, {
    tentativaAtual: numero,
    iniciadoEm: agora,
    tentativas: [...run.tentativas, attempt],
    erro: null,
  });
}

export function concluir(run: MissionRun, resultado: RunResultado, agora: string): MissionRun {
  const tentativas = run.tentativas.map((t, i) =>
    i === run.tentativas.length - 1
      ? { ...t, fim: agora, status: "sucesso" as const, resultado }
      : t
  );
  return transicionar(run, "concluida", "Execução concluída", agora, {
    tentativas,
    resultado,
    finalizadoEm: agora,
    erro: null,
  });
}

// Falha com retentativa controlada: enquanto houver tentativas disponíveis, a
// execução volta para a fila; caso contrário, encerra como "falhou".
export function falhar(
  run: MissionRun,
  erro: string,
  agora: string,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): MissionRun {
  const tentativas = run.tentativas.map((t, i) =>
    i === run.tentativas.length - 1
      ? { ...t, fim: agora, status: "falha" as const, erro }
      : t
  );
  const podeRetentar = tentativas.length < config.maxTentativas;
  const base: MissionRun = { ...run, tentativas, erro };

  if (podeRetentar) {
    return transicionar(base, "enfileirada", `Falha: ${erro} — reagendada para nova tentativa`, agora, {
      iniciadoEm: null,
    });
  }
  return transicionar(base, "falhou", `Falha definitiva após ${tentativas.length} tentativa(s): ${erro}`, agora, {
    finalizadoEm: agora,
  });
}

export function cancelar(run: MissionRun, agora: string, motivo = "Cancelada pelo operador"): MissionRun {
  if (ehTerminal(run.status)) return run;
  return transicionar(run, "cancelada", motivo, agora, { finalizadoEm: agora });
}

export function expirar(run: MissionRun, agora: string, config: EngineConfig = DEFAULT_ENGINE_CONFIG): MissionRun {
  const tentativas = run.tentativas.map((t, i) =>
    i === run.tentativas.length - 1
      ? { ...t, fim: agora, status: "timeout" as const, erro: "Timeout excedido" }
      : t
  );
  const base: MissionRun = { ...run, tentativas, erro: "Timeout excedido" };
  const podeRetentar = tentativas.length < config.maxTentativas;
  if (podeRetentar) {
    return transicionar(base, "enfileirada", "Timeout — reagendada para nova tentativa", agora, {
      iniciadoEm: null,
    });
  }
  return transicionar(base, "expirada", "Timeout definitivo", agora, { finalizadoEm: agora });
}

// Aprovação humana: libera (ou nega) uma execução crítica.
export function resolverAprovacao(
  run: MissionRun,
  aprovado: boolean,
  agora: string,
  justificativa = ""
): MissionRun {
  if (run.status !== "aguardando_aprovacao") return run;
  if (aprovado) {
    return transicionar(run, "enfileirada", `Aprovação concedida. ${justificativa}`.trim(), agora);
  }
  return transicionar(run, "cancelada", `Aprovação negada. ${justificativa}`.trim(), agora, {
    finalizadoEm: agora,
  });
}

function solicitarAprovacao(run: MissionRun, agora: string): MissionRun {
  return transicionar(run, "aguardando_aprovacao", "Operação crítica aguardando aprovação humana", agora);
}

function marcarAguardandoDependencia(run: MissionRun, agora: string): MissionRun {
  return transicionar(run, "aguardando_dependencia", "Aguardando conclusão das dependências", agora);
}

function voltarParaFila(run: MissionRun, agora: string): MissionRun {
  return transicionar(run, "enfileirada", "Dependências concluídas; de volta à fila", agora);
}

/* ------------------------------------------------------------------ */
/* Passo do motor                                                      */
/* ------------------------------------------------------------------ */

export interface ProcessarParams {
  runs: MissionRun[];
  missoes: MissionView[];
  config?: EngineConfig;
  agora?: string;
  // Quais missões críticas já possuem aprovação concedida (por runId).
  aprovadas?: Set<string>;
}

// Executa um ciclo do motor:
//   1. expira execuções que estouraram o timeout;
//   2. reavalia dependências (aguardando_dependencia ⇄ enfileirada);
//   3. inicia novas execuções respeitando a concorrência e a prioridade;
//   4. trava execuções críticas sem aprovação em "aguardando_aprovacao".
export function processar(params: ProcessarParams): EngineStepResult {
  const config = params.config ?? DEFAULT_ENGINE_CONFIG;
  const agora = params.agora ?? new Date().toISOString();
  const aprovadas = params.aprovadas ?? new Set<string>();
  const agoraMs = Date.parse(agora);

  const expirados: string[] = [];
  const iniciados: string[] = [];
  const mensagens: string[] = [];

  // 1. Timeout de execuções em andamento.
  let runs = params.runs.map((run) => {
    if (run.status !== "executando" || !run.iniciadoEm) return run;
    const decorrido = agoraMs - Date.parse(run.iniciadoEm);
    if (decorrido >= config.timeoutMs) {
      expirados.push(run.id);
      return expirar(run, agora, config);
    }
    return run;
  });

  // 2. Dependências.
  runs = runs.map((run) => {
    if (run.status === "aguardando_dependencia") {
      return dependenciasSatisfeitas(run, params.missoes) ? voltarParaFila(run, agora) : run;
    }
    if (run.status === "enfileirada" && !dependenciasSatisfeitas(run, params.missoes)) {
      return marcarAguardandoDependencia(run, agora);
    }
    return run;
  });
  if (expirados.length > 0) mensagens.push(`${expirados.length} execução(ões) expirada(s) por timeout.`);

  // 3. Concorrência: quantas ainda cabem?
  let vagas = Math.max(0, config.maxConcorrencia - emExecucao(runs).length);
  if (vagas > 0) {
    // Só inicia execuções prontas (enfileirada). Runs em "aguardando_dependencia"
    // aparecem na fila para exibição, mas não devem ser iniciadas enquanto a
    // dependência não for concluída — caso contrário a ordem sequencial seria
    // violada na própria passagem que detecta o bloqueio.
    const fila = filaOrdenada(runs).filter((r) => r.status === "enfileirada");
    const iniciarAgora = new Set<string>();
    for (const run of fila) {
      if (vagas <= 0) break;
      // 4. Operações críticas exigem aprovação humana.
      if (run.criticidade === "critica" && !aprovadas.has(run.id)) {
        runs = runs.map((r) => (r.id === run.id ? solicitarAprovacao(r, agora) : r));
        mensagens.push(`${run.missaoCodigo} aguardando aprovação humana.`);
        continue;
      }
      iniciarAgora.add(run.id);
      vagas -= 1;
    }
    if (iniciarAgora.size > 0) {
      runs = runs.map((r) => (iniciarAgora.has(r.id) ? iniciar(r, agora) : r));
      iniciados.push(...iniciarAgora);
    }
  }

  return { runs, iniciados, concluidos: [], expirados, mensagens };
}
