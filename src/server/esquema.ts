// =====================================================================
// FIRE Agent Command Center — LAB-004
// Validação de entradas server-side (esquema por operação).
//
// Nenhuma entrada chega à camada de domínio sem passar por aqui. A validação
// de frontend é conveniência de UX; a autoridade é sempre este módulo.
// =====================================================================

import { detectarSegredos } from "../platform/validation";
import { PAPEL_LABEL, type Papel } from "../platform/types";
import { EVIDENCE_KIND_LABEL, type EvidenceKind } from "../platform/types";
import { ApiError } from "./http";

const PAPEIS = Object.keys(PAPEL_LABEL) as Papel[];
const TIPOS_EVIDENCIA = Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[];

function exigirObjeto(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("requisicao_invalida", "O corpo da requisição deve ser um objeto JSON.");
  }
  return body as Record<string, unknown>;
}

function texto(
  obj: Record<string, unknown>,
  campo: string,
  opts: { min?: number; max?: number; obrigatorio?: boolean } = {}
): string {
  const { min = 1, max = 2000, obrigatorio = true } = opts;
  const valor = obj[campo];
  if (valor === undefined || valor === null) {
    if (obrigatorio) throw new ApiError("requisicao_invalida", `O campo "${campo}" é obrigatório.`);
    return "";
  }
  if (typeof valor !== "string") {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" deve ser texto.`);
  }
  const limpo = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
  if (limpo.length === 0) {
    if (obrigatorio && min > 0) {
      throw new ApiError("requisicao_invalida", `O campo "${campo}" é obrigatório.`);
    }
    return "";
  }
  if (limpo.length < min) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" deve ter ao menos ${min} caractere(s).`);
  }
  if (limpo.length > max) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" excede ${max} caracteres.`);
  }
  const segredos = detectarSegredos(limpo);
  if (segredos.contem) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" contém o que parece ser uma credencial.`, {
      motivos: segredos.motivos,
    });
  }
  return limpo;
}

function email(obj: Record<string, unknown>, campo = "email"): string {
  const valor = texto(obj, campo, { max: 200 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
    throw new ApiError("requisicao_invalida", "E-mail inválido.");
  }
  return valor.toLowerCase();
}

function idObrigatorio(obj: Record<string, unknown>, campo: string): string {
  const valor = obj[campo];
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" é obrigatório.`);
  }
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(valor.trim())) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" tem formato inválido.`);
  }
  return valor.trim();
}

function enumDe<T extends string>(obj: Record<string, unknown>, campo: string, permitidos: readonly T[]): T {
  const valor = obj[campo];
  if (typeof valor !== "string" || !permitidos.includes(valor as T)) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" deve ser um de: ${permitidos.join(", ")}.`);
  }
  return valor as T;
}

function listaTextos(obj: Record<string, unknown>, campo: string, max = 50): string[] {
  const valor = obj[campo];
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" deve ser uma lista.`);
  }
  if (valor.length > max) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" excede ${max} itens.`);
  }
  return valor.map((item, i) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new ApiError("requisicao_invalida", `Item ${i} de "${campo}" inválido.`);
    }
    return item.trim().slice(0, 500);
  });
}

/* ------------------------------------------------------------------ */

export interface LoginValidado {
  email: string;
  senha: string;
}

export function validarLogin(body: unknown): LoginValidado {
  const obj = exigirObjeto(body);
  const senha = obj["senha"];
  if (typeof senha !== "string" || senha.length < 6 || senha.length > 200) {
    throw new ApiError("requisicao_invalida", "A senha deve ter entre 6 e 200 caracteres.");
  }
  return { email: email(obj), senha };
}

export interface OrganizacaoValidada {
  nome: string;
  ambiente: "demonstracao" | "homologacao" | "producao";
}

export function validarCriarOrganizacao(body: unknown): OrganizacaoValidada {
  const obj = exigirObjeto(body);
  return {
    nome: texto(obj, "nome", { min: 2, max: 120 }),
    ambiente: obj["ambiente"] === undefined ? "demonstracao" : enumDe(obj, "ambiente", ["demonstracao", "homologacao", "producao"] as const),
  };
}

export interface UsuarioValidado {
  nome: string;
  email: string;
  papel: Papel;
}

export function validarCriarUsuario(body: unknown): UsuarioValidado {
  const obj = exigirObjeto(body);
  return {
    nome: texto(obj, "nome", { min: 2, max: 120 }),
    email: email(obj),
    papel: enumDe(obj, "papel", PAPEIS),
  };
}

export interface MissaoValidada {
  codigo: string;
  titulo: string;
  objetivo: string;
  instrucoes: string;
  prioridade: "alta" | "media" | "baixa";
  criteriosAceite: string[];
  dependencias: string[];
}

export function validarCriarMissao(body: unknown): MissaoValidada {
  const obj = exigirObjeto(body);
  return {
    codigo: texto(obj, "codigo", { min: 2, max: 40 }),
    titulo: texto(obj, "titulo", { min: 3, max: 160 }),
    objetivo: texto(obj, "objetivo", { min: 3, max: 4000 }),
    instrucoes: texto(obj, "instrucoes", { min: 1, max: 8000, obrigatorio: false }),
    prioridade: obj["prioridade"] === undefined ? "media" : enumDe(obj, "prioridade", ["alta", "media", "baixa"] as const),
    criteriosAceite: listaTextos(obj, "criteriosAceite"),
    dependencias: listaTextos(obj, "dependencias"),
  };
}

export interface ExecucaoValidada {
  missaoId: string;
  criticidade: "normal" | "critica";
  chaveIdempotencia: string | null;
}

export function validarEnfileirarExecucao(body: unknown): ExecucaoValidada {
  const obj = exigirObjeto(body);
  const chave = obj["chaveIdempotencia"];
  return {
    missaoId: idObrigatorio(obj, "missaoId"),
    criticidade: obj["criticidade"] === undefined ? "normal" : enumDe(obj, "criticidade", ["normal", "critica"] as const),
    chaveIdempotencia:
      typeof chave === "string" && chave.trim().length > 0 ? chave.trim().slice(0, 200) : null,
  };
}

export interface EvidenciaValidada {
  tipo: EvidenceKind;
  referencia: string;
  descricao: string;
  valor: string;
  missaoId: string | null;
  runId: string | null;
  origemDado: "informado_agente" | "informado_operador";
}

export function validarRegistrarEvidencia(body: unknown): EvidenciaValidada {
  const obj = exigirObjeto(body);
  const missaoId = obj["missaoId"];
  const runId = obj["runId"];
  return {
    tipo: enumDe(obj, "tipo", TIPOS_EVIDENCIA),
    referencia: texto(obj, "referencia", { min: 1, max: 500 }),
    descricao: texto(obj, "descricao", { min: 1, max: 2000 }),
    valor: texto(obj, "valor", { min: 1, max: 4000, obrigatorio: false }),
    missaoId: typeof missaoId === "string" && missaoId.trim() ? missaoId.trim() : null,
    runId: typeof runId === "string" && runId.trim() ? runId.trim() : null,
    // O cliente NUNCA pode se declarar "verificado_independente": esse estado
    // só é alcançado pela rota dedicada de verificação, com verificador válido.
    origemDado: obj["origemDado"] === "informado_operador" ? "informado_operador" : "informado_agente",
  };
}

export interface AprovacaoValidada {
  runId: string;
  aprovado: boolean;
  justificativa: string;
}

export function validarDecisaoAprovacao(body: unknown): AprovacaoValidada {
  const obj = exigirObjeto(body);
  const aprovado = obj["aprovado"];
  if (typeof aprovado !== "boolean") {
    throw new ApiError("requisicao_invalida", 'O campo "aprovado" deve ser booleano.');
  }
  return {
    runId: idObrigatorio(obj, "runId"),
    aprovado,
    justificativa: texto(obj, "justificativa", { min: 1, max: 500, obrigatorio: false }),
  };
}

export interface ProvedorValidado {
  id: string;
}

export function validarProvedorId(body: unknown): ProvedorValidado {
  const obj = exigirObjeto(body);
  return { id: texto(obj, "id", { min: 2, max: 60 }) };
}

export interface AtivacaoProvedorValidada {
  id: string;
  ativo: boolean;
}

// Kill switch do operador. `ativo=false` desativa o provedor no servidor;
// `ativo=true` o reativa. Nunca aceita identidade de quem solicita.
export function validarAtivacaoProvedor(body: unknown): AtivacaoProvedorValidada {
  const obj = exigirObjeto(body);
  const ativo = obj["ativo"];
  if (typeof ativo !== "boolean") {
    throw new ApiError("requisicao_invalida", 'O campo "ativo" deve ser booleano.');
  }
  return { id: texto(obj, "id", { min: 2, max: 60 }), ativo };
}
