// Tipos da camada de adaptadores de agentes de IA.
//
// Regra absoluta de honestidade operacional: um adaptador SEM autorização real
// NUNCA pode reportar-se "disponivel". Sem credencial/permissão validada, ele
// permanece "nao_autorizado" (ou "indisponivel") e qualquer envio de missão cai
// no fluxo manual assistido (exportar missão / importar resultado).
//
// Esta camada é pura: não chama rede, não embute credenciais e não presume
// endpoints, versões de API ou capacidades que não tenham sido verificadas.

import type { MissionView } from "../orchestration/types";

export type AdapterCapability =
  | "texto"
  | "codigo"
  | "documentos"
  | "planilhas"
  | "web"
  | "execucao_local"
  | "revisao"
  | "pesquisa"
  | "relatorios";

export const ADAPTER_CAPABILITY_LABEL: Record<AdapterCapability, string> = {
  texto: "Texto",
  codigo: "Código",
  documentos: "Documentos",
  planilhas: "Planilhas",
  web: "Web",
  execucao_local: "Execução local",
  revisao: "Revisão",
  pesquisa: "Pesquisa",
  relatorios: "Relatórios",
};

export type AdapterStatus = "disponivel" | "nao_autorizado" | "indisponivel" | "manual_assistido";

export const ADAPTER_STATUS_LABEL: Record<AdapterStatus, string> = {
  disponivel: "Disponível",
  nao_autorizado: "Não autorizado",
  indisponivel: "Indisponível",
  manual_assistido: "Manual assistido",
};

// Descrição imutável de um adaptador: o que ele é e o que exigiria para operar.
export interface AdapterDescriptor {
  id: string;
  nome: string;
  descricao: string;
  capacidades: AdapterCapability[];
  provedorId: string | null;
  requerimentos: string[];
  canalOficial: string | null;
}

// Disponibilidade verificada. `verificadoEm` só é preenchido quando houver uma
// verificação real; enquanto não houver, permanece null.
export interface AdapterAvailability {
  status: AdapterStatus;
  motivo: string;
  verificadoEm: string | null;
}

// Resultado do envio de uma missão. "manual_assistido" significa que nada foi
// enviado automaticamente — o operador conduz o fluxo manualmente.
export interface AdapterSubmission {
  aceito: boolean;
  referencia: string | null;
  modo: "automatico" | "manual_assistido";
  mensagem: string;
}

// Estado de acompanhamento de uma execução remota. Sem integração autorizada o
// estado é sempre "desconhecido".
export interface AdapterExecutionState {
  referencia: string;
  estado: "desconhecido" | "em_andamento" | "concluido" | "falhou";
  atualizadoEm: string;
  detalhe: string;
}

// Resultado recebido de uma execução. `artefatos` lista itens verificáveis
// (commits, PRs, relatórios etc.) informados e não validados por conta própria.
export interface AdapterResult {
  referencia: string;
  resumo: string;
  artefatos: { nome: string; valor: string }[];
  recebidoEm: string;
}

// Contrato único que todo adaptador (externo, personalizado ou local) cumpre.
export interface AgentAdapter {
  descriptor: AdapterDescriptor;
  validarDisponibilidade(): AdapterAvailability;
  enviarMissao(payload: { missao: MissionView; prompt: string }): AdapterSubmission;
  consultarExecucao(referencia: string): AdapterExecutionState;
  receberResultado(referencia: string): AdapterResult | null;
  tratarErro(erro: unknown): string;
  controleConsumo(): { unidade: string; observacao: string };
}
