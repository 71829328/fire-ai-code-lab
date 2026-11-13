// Central de evidências (LAB-003).
//
// Regra de honestidade operacional: um registro só passa a ser "verificado
// independentemente" quando existe um verificador identificado. Nunca
// promovemos uma evidência a "verificada" sem essa comprovação — enquanto isso
// ela permanece apenas "informada".

import {
  EVIDENCE_KIND_LABEL,
  type EvidenceKind,
  type EvidenceRecord,
  type OrigemDado,
} from "../platform/types";

const EVIDENCE_KINDS = Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[];

// Gera um identificador único sem depender de bibliotecas externas.
export function gerarIdEvidencia(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cripto?.randomUUID) return `ev-${cripto.randomUUID()}`;
  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface CriarEvidenceRecordParams {
  organizacaoId: string;
  tipo: EvidenceKind;
  referencia: string;
  descricao: string;
  valor?: string;
  missaoId?: string | null;
  runId?: string | null;
  origemDado?: OrigemDado;
  registradoPor?: string | null;
  // Só é levado em conta quando origemDado === "verificado_independente".
  verificador?: string | null;
  agora?: string;
  id?: string;
}

// Cria um registro de evidência coerente com sua origem declarada:
//   - "verificado_independente" exige verificador e marca verificadoEm = agora;
//   - qualquer outra origem mantém verificadoPor/verificadoEm nulos (informado).
export function criarEvidenceRecord(params: CriarEvidenceRecordParams): EvidenceRecord {
  const agora = params.agora ?? new Date().toISOString();
  const origemDado: OrigemDado = params.origemDado ?? "informado_agente";
  const verificado = origemDado === "verificado_independente";
  return {
    id: params.id ?? gerarIdEvidencia(),
    organizacaoId: params.organizacaoId,
    missaoId: params.missaoId ?? null,
    runId: params.runId ?? null,
    tipo: params.tipo,
    referencia: params.referencia,
    descricao: params.descricao,
    valor: params.valor ?? "",
    origemDado,
    registradoPor: params.registradoPor ?? null,
    verificadoPor: verificado ? (params.verificador ?? null) : null,
    verificadoEm: verificado ? agora : null,
    timestamp: agora,
  };
}

// Promove uma evidência existente a "verificada independentemente". Só é
// possível com um verificador não vazio — sem ele não há verificação real.
export function verificarIndependente(
  evidencia: EvidenceRecord,
  verificador: string,
  agora?: string
): EvidenceRecord {
  const nome = typeof verificador === "string" ? verificador.trim() : "";
  if (!nome) throw new Error("Verificador obrigatório");
  return {
    ...evidencia,
    origemDado: "verificado_independente",
    verificadoPor: nome,
    verificadoEm: agora ?? new Date().toISOString(),
  };
}

export interface ResultadoValidacaoEvidencia {
  valido: boolean;
  motivos: string[];
}

// Valida os campos obrigatórios de um EvidenceRecord. Não espera campos que não
// existem no modelo — apenas confere o contrato real do registro.
export function validarEvidenceRecord(ev: unknown): ResultadoValidacaoEvidencia {
  const motivos: string[] = [];
  if (typeof ev !== "object" || ev === null || Array.isArray(ev)) {
    return { valido: false, motivos: ["registro não é um objeto"] };
  }
  const registro = ev as Record<string, unknown>;
  if (typeof registro.id !== "string" || registro.id.trim() === "") {
    motivos.push("id ausente ou inválido");
  }
  if (typeof registro.organizacaoId !== "string" || registro.organizacaoId.trim() === "") {
    motivos.push("organizacaoId ausente ou inválido");
  }
  if (typeof registro.tipo !== "string" || !EVIDENCE_KINDS.includes(registro.tipo as EvidenceKind)) {
    motivos.push("tipo inválido");
  }
  if (typeof registro.referencia !== "string" || registro.referencia.trim() === "") {
    motivos.push("referencia ausente");
  }
  if (typeof registro.timestamp !== "string" || Number.isNaN(Date.parse(registro.timestamp))) {
    motivos.push("timestamp inválido (ISO esperado)");
  }
  return { valido: motivos.length === 0, motivos };
}

export interface EvidenciasSeparadas {
  informadas: EvidenceRecord[];
  verificadas: EvidenceRecord[];
}

// Separa por origem: "verificadas" apenas as comprovadas independentemente;
// todo o resto (informado pelo agente/operador) entra em "informadas".
export function separarPorOrigem(evidencias: EvidenceRecord[]): EvidenciasSeparadas {
  const informadas: EvidenceRecord[] = [];
  const verificadas: EvidenceRecord[] = [];
  for (const ev of evidencias) {
    if (ev.origemDado === "verificado_independente") verificadas.push(ev);
    else informadas.push(ev);
  }
  return { informadas, verificadas };
}

export interface ResumoEvidencias {
  total: number;
  informadas: number;
  verificadas: number;
  porTipo: Record<string, number>;
}

export function resumirEvidencias(evidencias: EvidenceRecord[]): ResumoEvidencias {
  const { informadas, verificadas } = separarPorOrigem(evidencias);
  const porTipo: Record<string, number> = {};
  for (const ev of evidencias) {
    porTipo[ev.tipo] = (porTipo[ev.tipo] ?? 0) + 1;
  }
  return {
    total: evidencias.length,
    informadas: informadas.length,
    verificadas: verificadas.length,
    porTipo,
  };
}
