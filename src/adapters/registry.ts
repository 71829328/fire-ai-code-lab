// Fábrica de adaptadores de agentes.
//
// Regra de honestidade: nenhum adaptador externo se declara "disponivel" sem
// autorização real. Enquanto não houver credencial/permissão validada, eles
// retornam "nao_autorizado"/"indisponivel" e recusam o envio automático,
// empurrando o operador para o fluxo manual assistido.

import type {
  AdapterAvailability,
  AdapterDescriptor,
  AdapterStatus,
  AgentAdapter,
} from "./types";
import { INTEGRACOES_CATALOGO } from "./capabilities";

const MENSAGEM_NAO_AUTORIZADO =
  "Integração não autorizada — use o fluxo manual assistido (exportar missão / importar resultado).";

const MENSAGEM_CUSTOM =
  "Agente personalizado opera apenas em fluxo manual assistido — exporte a missão e importe o resultado para registrar evidências.";

// Requisitos de ativação vêm do catálogo, evitando duplicar/reescrever promessas.
function requerimentosDe(id: string): string[] {
  return INTEGRACOES_CATALOGO.find((item) => item.id === id)?.requerimentos ?? [];
}

const DESCRITORES: AdapterDescriptor[] = [
  {
    id: "chatgpt",
    nome: "ChatGPT",
    descricao: "Interface de conversação para apoio à redação e revisão de missões.",
    capacidades: ["texto", "revisao"],
    provedorId: "chatgpt",
    requerimentos: requerimentosDe("chatgpt"),
    canalOficial: null,
  },
  {
    id: "codex",
    nome: "Codex",
    descricao: "Interface de geração e revisão de código em repositórios autorizados.",
    capacidades: ["codigo", "revisao"],
    provedorId: "codex",
    requerimentos: requerimentosDe("codex"),
    canalOficial: null,
  },
  {
    id: "work",
    nome: "Work",
    descricao: "Interface de automação de documentos e planilhas corporativas.",
    capacidades: ["documentos", "planilhas", "relatorios"],
    provedorId: "work",
    requerimentos: requerimentosDe("work"),
    canalOficial: null,
  },
  {
    id: "trae",
    nome: "TRAE",
    descricao: "Interface de agente de desenvolvimento integrado ao ambiente.",
    capacidades: ["codigo", "execucao_local", "revisao"],
    provedorId: "trae",
    requerimentos: requerimentosDe("trae"),
    canalOficial: null,
  },
  {
    id: "manus",
    nome: "Manus",
    descricao: "Interface de execução autônoma de tarefas de ponta a ponta.",
    capacidades: ["pesquisa", "web", "relatorios"],
    provedorId: "manus",
    requerimentos: requerimentosDe("manus"),
    canalOficial: null,
  },
  {
    id: "fire_private_ai",
    nome: "FIRE Private AI",
    descricao: "Camada privada de IA do próprio negócio, ainda não disponibilizada.",
    capacidades: [
      "texto",
      "codigo",
      "documentos",
      "planilhas",
      "web",
      "execucao_local",
      "revisao",
      "pesquisa",
      "relatorios",
    ],
    provedorId: "fire_private_ai",
    requerimentos: requerimentosDe("fire_private_ai"),
    canalOficial: null,
  },
  {
    id: "custom",
    nome: "Agentes personalizados (cadastro do operador)",
    descricao: "Agentes cadastrados pelo próprio operador; operam em fluxo manual assistido.",
    capacidades: ["texto", "codigo", "documentos", "relatorios"],
    provedorId: null,
    requerimentos: requerimentosDe("custom"),
    canalOficial: null,
  },
];

// Status/motivo dos provedores externos. fire_private_ai aguarda disponibilização;
// todos os demais estão sem credencial/autorização validada.
const DISPONIBILIDADE_EXTERNA: Record<string, { status: AdapterStatus; motivo: string }> = {
  chatgpt: { status: "nao_autorizado", motivo: "Sem credencial/autorização validada" },
  codex: { status: "nao_autorizado", motivo: "Sem credencial/autorização validada" },
  work: { status: "nao_autorizado", motivo: "Sem credencial/autorização validada" },
  trae: { status: "nao_autorizado", motivo: "Sem credencial/autorização validada" },
  manus: { status: "nao_autorizado", motivo: "Sem credencial/autorização validada" },
  fire_private_ai: {
    status: "indisponivel",
    motivo: "Aguardando disponibilização do FIRE Private AI",
  },
};

function tratarErroPadrao(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Erro desconhecido no adaptador.";
}

// Adaptador de provedor externo: sempre recusa envio automático sem autorização.
function criarAdaptadorExterno(
  descriptor: AdapterDescriptor,
  disponibilidade: { status: AdapterStatus; motivo: string }
): AgentAdapter {
  const estado: AdapterAvailability = {
    status: disponibilidade.status,
    motivo: disponibilidade.motivo,
    verificadoEm: null,
  };

  return {
    descriptor,
    validarDisponibilidade: () => ({ ...estado }),
    enviarMissao: () => ({
      aceito: false,
      referencia: null,
      modo: "manual_assistido",
      mensagem: MENSAGEM_NAO_AUTORIZADO,
    }),
    consultarExecucao: (referencia) => ({
      referencia,
      estado: "desconhecido",
      atualizadoEm: new Date().toISOString(),
      detalhe: "Nenhuma execução remota é acompanhada: integração sem autorização validada.",
    }),
    receberResultado: () => null,
    tratarErro: tratarErroPadrao,
    controleConsumo: () => ({
      unidade: "requisicoes",
      observacao: "Consumo não monitorado: sem integração autorizada não há telemetria real.",
    }),
  };
}

// Adaptador personalizado: única modalidade utilizável hoje (fluxo manual).
function criarAdaptadorCustom(descriptor: AdapterDescriptor): AgentAdapter {
  const estado: AdapterAvailability = {
    status: "manual_assistido",
    motivo: "Agente personalizado cadastrado pelo operador: opera apenas em fluxo manual assistido.",
    verificadoEm: null,
  };

  return {
    descriptor,
    validarDisponibilidade: () => ({ ...estado }),
    enviarMissao: () => ({
      aceito: false,
      referencia: null,
      modo: "manual_assistido",
      mensagem: MENSAGEM_CUSTOM,
    }),
    consultarExecucao: (referencia) => ({
      referencia,
      estado: "desconhecido",
      atualizadoEm: new Date().toISOString(),
      detalhe: "Acompanhamento de execução não disponível no fluxo manual assistido.",
    }),
    receberResultado: () => null,
    tratarErro: tratarErroPadrao,
    controleConsumo: () => ({
      unidade: "manual",
      observacao: "Fluxo manual assistido: o consumo é informado pelo operador, sem telemetria automática.",
    }),
  };
}

export function criarRegistro(): Record<string, AgentAdapter> {
  const registro: Record<string, AgentAdapter> = {};
  for (const descriptor of DESCRITORES) {
    if (descriptor.id === "custom") {
      registro[descriptor.id] = criarAdaptadorCustom(descriptor);
      continue;
    }
    registro[descriptor.id] = criarAdaptadorExterno(
      descriptor,
      DISPONIBILIDADE_EXTERNA[descriptor.id]
    );
  }
  return registro;
}

export function listarAdaptadores(): AgentAdapter[] {
  return Object.values(criarRegistro());
}

export function obterAdaptador(id: string): AgentAdapter | null {
  return criarRegistro()[id] ?? null;
}
