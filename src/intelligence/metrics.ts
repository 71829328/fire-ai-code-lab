// Métricas operacionais por agente (LAB-003).
//
// Regra central: só medimos o que foi observado. Nada é estimado nem
// "preenchido" com valores plausíveis. Quando não há dado suficiente, o campo
// correspondente retorna null (ou lista vazia), nunca um número inventado.

import type { MissionRun } from "../orchestration/types";
import type { EvidenceRecord, UsageMetric } from "../platform/types";

export interface MetricasAgente {
  agenteId: string;
  missoesConcluidas: number;
  missoesFalhadas: number;
  taxaSucesso: number | null;
  tempoMedioMs: number | null;
  erros: number;
  testesAprovados: number;
  retrabalho: number;
  consumoInformado: number;
  especialidades: string[];
}

export interface CalcularMetricasParams {
  agenteId: string;
  runs: MissionRun[];
  evidencias: EvidenceRecord[];
  consumo: UsageMetric[];
  agora?: string;
}

// Duração de uma run concluída (finalizadoEm - criadoEm). Retorna null quando
// os carimbos não existem ou não são datas válidas.
function duracaoMs(run: MissionRun): number | null {
  if (!run.finalizadoEm) return null;
  const inicio = Date.parse(run.criadoEm);
  const fim = Date.parse(run.finalizadoEm);
  if (Number.isNaN(inicio) || Number.isNaN(fim)) return null;
  const delta = fim - inicio;
  return delta >= 0 ? delta : null;
}

// Relaciona uma evidência ao agente pelos vínculos reais disponíveis: o registro
// pode apontar para uma run do agente (runId) ou para uma missão executada por
// ele (missaoId). Não há campo agenteId na evidência — por isso usamos os runs.
function evidenciasDoAgente(
  runsDoAgente: MissionRun[],
  evidencias: EvidenceRecord[]
): EvidenceRecord[] {
  const runIds = new Set(runsDoAgente.map((r) => r.id));
  const missaoIds = new Set(runsDoAgente.map((r) => r.missaoId));
  return evidencias.filter((ev) => {
    if (ev.runId && runIds.has(ev.runId)) return true;
    if (ev.missaoId && missaoIds.has(ev.missaoId)) return true;
    return false;
  });
}

export function calcularMetricasAgente(params: CalcularMetricasParams): MetricasAgente {
  const { agenteId, runs, evidencias, consumo } = params;

  const runsDoAgente = runs.filter((r) => r.agenteId === agenteId);
  const concluidas = runsDoAgente.filter((r) => r.status === "concluida");
  const falhadas = runsDoAgente.filter((r) => r.status === "falhou" || r.status === "expirada");

  const denominador = concluidas.length + falhadas.length;
  const taxaSucesso = denominador === 0 ? null : concluidas.length / denominador;

  const duracoes = concluidas
    .map(duracaoMs)
    .filter((d): d is number => d !== null);
  const tempoMedioMs =
    duracoes.length === 0 ? null : duracoes.reduce((soma, d) => soma + d, 0) / duracoes.length;

  let erros = 0;
  for (const run of runsDoAgente) {
    for (const tentativa of run.tentativas) {
      if (tentativa.status === "falha" || tentativa.status === "timeout") erros += 1;
    }
  }

  const evidenciasAgente = evidenciasDoAgente(runsDoAgente, evidencias);
  const testesAprovados = evidenciasAgente.filter(
    (ev) =>
      ev.tipo === "teste" &&
      `${ev.valor} ${ev.descricao}`.toLowerCase().includes("aprovad")
  ).length;

  const retrabalho = runsDoAgente.filter((r) => r.tentativas.length > 1).length;

  const consumoInformado = consumo
    .filter((c) => c.agenteId === agenteId)
    .reduce((soma, c) => soma + c.quantidade, 0);

  return {
    agenteId,
    missoesConcluidas: concluidas.length,
    missoesFalhadas: falhadas.length,
    taxaSucesso,
    tempoMedioMs,
    erros,
    testesAprovados,
    retrabalho,
    consumoInformado,
    // Não há campo confiável de "capabilities" nos runs e derivar especialidades
    // de tipos de missão/evidência seria suposição. Por padrão retornamos lista
    // vazia (NUNCA fabricamos). Quando houver base real, use
    // `calcularEspecialidades` a partir das evidências verificadas.
    especialidades: [],
  };
}

// Deriva especialidades apenas de evidências verificado-independentemente — a
// única base em que confiamos. Sem nenhuma evidência verificada, retorna [] em
// vez de inferir algo a partir de dados não comprovados.
export function calcularEspecialidades(evidencias: EvidenceRecord[]): string[] {
  const tipos = new Set<string>();
  for (const ev of evidencias) {
    if (ev.origemDado === "verificado_independente" && ev.tipo) {
      tipos.add(ev.tipo);
    }
  }
  return Array.from(tipos).sort();
}

export interface MetricasAgenteComNome {
  agenteId: string;
  nome: string;
  metricas: MetricasAgente;
}

export function calcularMetricasTodos(params: {
  agentes: { id: string; nome: string }[];
  runs: MissionRun[];
  evidencias: EvidenceRecord[];
  consumo: UsageMetric[];
}): MetricasAgenteComNome[] {
  return params.agentes.map((agente) => ({
    agenteId: agente.id,
    nome: agente.nome,
    metricas: calcularMetricasAgente({
      agenteId: agente.id,
      runs: params.runs,
      evidencias: params.evidencias,
      consumo: params.consumo,
    }),
  }));
}
