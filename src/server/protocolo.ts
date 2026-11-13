// =====================================================================
// FIRE Agent Command Center — LAB-004
// Protocolo interno padronizado entre agentes + gateway extensível.
//
// O protocolo é um ENVELOPE de missão versionado ("fire-agent/1") que descreve
// tudo o que um agente precisa para executar e reportar: identificador,
// objetivo, contexto, restrições, critérios de aceite, dependências, agente
// responsável, estado, resultado, evidências, consumo e erros.
//
// HONESTIDADE: o gateway NÃO inventa APIs privadas. Sem um transporte
// autorizado registrado para um agente, o envio cai no fluxo MANUAL ASSISTIDO
// (exportar/importar). Registre um `TransporteAgente` apenas quando houver
// integração oficial autorizada.
// =====================================================================

import type { AdapterStatus } from "../adapters/types";
import type { MissionRun, RunStatus } from "../orchestration/types";
import type { MissaoServidor } from "./store";

export const PROTOCOLO_VERSAO = "fire-agent/1";

export type EstadoExecucaoProtocolo =
  | "enfileirada"
  | "em_execucao"
  | "aguardando_aprovacao"
  | "concluida"
  | "falhou"
  | "cancelada"
  | "expirada";

export interface EvidenciaProtocolo {
  tipo: string;
  referencia: string;
  descricao: string;
  origem: "informado_agente" | "informado_operador" | "verificado_independente";
}

export interface ConsumoProtocolo {
  unidade: string;
  quantidade: number;
}

export interface ResultadoProtocolo {
  resumo: string;
  artefatos: { nome: string; valor: string }[];
}

export interface EnvelopeMissao {
  protocolo: typeof PROTOCOLO_VERSAO;
  missaoId: string;
  missaoCodigo: string;
  objetivo: string;
  contexto: string;
  restricoes: string[];
  criteriosAceite: string[];
  dependencias: string[];
  agenteResponsavel: string | null;
  estado: EstadoExecucaoProtocolo;
  resultado: ResultadoProtocolo | null;
  evidencias: EvidenciaProtocolo[];
  consumo: ConsumoProtocolo | null;
  erros: string[];
  criadoEm: string;
  atualizadoEm: string;
}

function mapearEstado(status: RunStatus): EstadoExecucaoProtocolo {
  switch (status) {
    case "enfileirada":
    case "aguardando_dependencia":
      return "enfileirada";
    case "executando":
      return "em_execucao";
    case "aguardando_aprovacao":
      return "aguardando_aprovacao";
    case "concluida":
      return "concluida";
    case "falhou":
      return "falhou";
    case "cancelada":
      return "cancelada";
    case "expirada":
      return "expirada";
  }
}

export interface MontarEnvelopeParams {
  missao: MissaoServidor;
  run?: MissionRun | null;
  contexto?: string;
  restricoes?: string[];
  evidencias?: EvidenciaProtocolo[];
  criadoEm?: string;
}

export function montarEnvelope(params: MontarEnvelopeParams): EnvelopeMissao {
  const { missao, run } = params;
  const agora = new Date().toISOString();
  return {
    protocolo: PROTOCOLO_VERSAO,
    missaoId: missao.id,
    missaoCodigo: missao.codigo,
    objetivo: missao.objetivo,
    contexto: params.contexto ?? "",
    restricoes: params.restricoes ?? [],
    criteriosAceite: [...missao.criteriosAceite],
    dependencias: [...missao.dependencias],
    agenteResponsavel: run?.agenteId ?? missao.agenteId,
    estado: run ? mapearEstado(run.status) : "enfileirada",
    resultado: run?.resultado ? { resumo: run.resultado.resumo, artefatos: [] } : null,
    evidencias: params.evidencias ?? [],
    consumo: null,
    erros: run?.erro ? [run.erro] : [],
    criadoEm: params.criadoEm ?? missao.criadoEm ?? agora,
    atualizadoEm: run?.atualizadoEm ?? agora,
  };
}

export interface ValidacaoEnvelope {
  valido: boolean;
  motivos: string[];
}

export function validarEnvelope(bruto: unknown): ValidacaoEnvelope {
  const motivos: string[] = [];
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return { valido: false, motivos: ["envelope não é um objeto"] };
  }
  const env = bruto as Record<string, unknown>;
  if (env.protocolo !== PROTOCOLO_VERSAO) motivos.push(`protocolo deve ser "${PROTOCOLO_VERSAO}"`);
  for (const campo of ["missaoId", "missaoCodigo", "objetivo", "estado"] as const) {
    if (typeof env[campo] !== "string" || (env[campo] as string).trim() === "") motivos.push(`${campo} ausente`);
  }
  for (const lista of ["restricoes", "criteriosAceite", "dependencias", "evidencias", "erros"] as const) {
    if (!Array.isArray(env[lista])) motivos.push(`${lista} deve ser uma lista`);
  }
  const estadosValidos = [
    "enfileirada",
    "em_execucao",
    "aguardando_aprovacao",
    "concluida",
    "falhou",
    "cancelada",
    "expirada",
  ];
  if (typeof env.estado === "string" && !estadosValidos.includes(env.estado)) {
    motivos.push(`estado inválido: ${env.estado}`);
  }
  return { valido: motivos.length === 0, motivos };
}

/* ------------------------------------------------------------------ */
/* Gateway extensível                                                  */
/* ------------------------------------------------------------------ */

export interface ResultadoEnvio {
  enviado: boolean;
  modo: "automatico" | "manual_assistido";
  referencia: string | null;
  mensagem: string;
}

export interface TransporteAgente {
  agenteId: string;
  disponibilidade(): { status: AdapterStatus; motivo: string };
  enviar(envelope: EnvelopeMissao): Promise<ResultadoEnvio>;
  consultar?(referencia: string): Promise<{ estado: EstadoExecucaoProtocolo; detalhe: string } | null>;
}

export interface AdaptadorRegistrado {
  agenteId: string;
  status: AdapterStatus;
  motivo: string;
  temTransporte: boolean;
}

const MENSAGEM_MANUAL_ASSISTIDO =
  "Nenhum transporte autorizado para este agente: use o fluxo manual assistido (exportar missão / importar resultado).";

export class GatewayAgentes {
  private readonly transportes = new Map<string, TransporteAgente>();

  registrar(transporte: TransporteAgente): void {
    this.transportes.set(transporte.agenteId, transporte);
  }

  remover(agenteId: string): void {
    this.transportes.delete(agenteId);
  }

  listar(agentesConhecidos: string[]): AdaptadorRegistrado[] {
    return agentesConhecidos.map((agenteId) => {
      const transporte = this.transportes.get(agenteId);
      if (!transporte) {
        return {
          agenteId,
          status: "nao_autorizado",
          motivo: MENSAGEM_MANUAL_ASSISTIDO,
          temTransporte: false,
        };
      }
      const disponibilidade = transporte.disponibilidade();
      return { agenteId, status: disponibilidade.status, motivo: disponibilidade.motivo, temTransporte: true };
    });
  }

  async enviar(agenteId: string, envelope: EnvelopeMissao): Promise<ResultadoEnvio> {
    const validacao = validarEnvelope(envelope);
    if (!validacao.valido) {
      return {
        enviado: false,
        modo: "manual_assistido",
        referencia: null,
        mensagem: `Envelope inválido: ${validacao.motivos.join("; ")}.`,
      };
    }
    const transporte = this.transportes.get(agenteId);
    if (!transporte) {
      return { enviado: false, modo: "manual_assistido", referencia: null, mensagem: MENSAGEM_MANUAL_ASSISTIDO };
    }
    const disponibilidade = transporte.disponibilidade();
    if (disponibilidade.status !== "disponivel") {
      return {
        enviado: false,
        modo: "manual_assistido",
        referencia: null,
        mensagem: `Transporte indisponível (${disponibilidade.status}): ${disponibilidade.motivo}`,
      };
    }
    return transporte.enviar(envelope);
  }
}

/** Gateway padrão: nenhum transporte registrado → tudo em fluxo manual assistido. */
export function criarGatewayPadrao(): GatewayAgentes {
  return new GatewayAgentes();
}

export const AGENTES_CONHECIDOS = ["chatgpt", "codex", "work", "trae", "manus", "fire_private_ai", "custom"];
