// Catálogo HONESTO de integrações de agentes de IA.
//
// Este catálogo descreve os requisitos REAIS de ativação de cada provedor com
// base em conhecimento geral. Regras cumpridas aqui:
//   - NÃO afirmamos acesso a nenhuma API paga;
//   - NÃO inventamos endpoints, versões de API, tokens ou capacidades;
//   - `canalOficial` permanece null porque não inventamos URLs oficiais.
//
// Qualquer integração real exige autorização e credencial fornecidas pelo
// PROPRIETÁRIO. Sem isso, o provedor permanece "nao_autorizado"/"indisponivel"
// e só é possível operar no fluxo manual assistido.

export interface DescritivoIntegracao {
  id: string;
  nome: string;
  canalOficial: string | null;
  requerimentos: string[];
  // `integracaoReal` = true apenas quando a integração é efetivamente utilizável
  // HOJE, neste ambiente, sem credencial adicional (fluxo manual assistido).
  integracaoReal: boolean;
  observacao: string;
}

export const INTEGRACOES_CATALOGO: DescritivoIntegracao[] = [
  {
    id: "chatgpt",
    nome: "ChatGPT",
    canalOficial: null,
    requerimentos: [
      "Autorização de uso da API oficial concedida pelo proprietário",
      "Chave de API própria do operador, nunca embutida no código",
    ],
    integracaoReal: false,
    observacao: "Provedor de texto real; sem credencial validada neste ambiente.",
  },
  {
    id: "codex",
    nome: "Codex",
    canalOficial: null,
    requerimentos: [
      "Autorização explícita do repositório pelo proprietário",
      "Escopos de leitura/escrita de código concedidos e verificados",
    ],
    integracaoReal: false,
    observacao: "Provedor de código real; sem autorização de repositório neste ambiente.",
  },
  {
    id: "work",
    nome: "Work",
    canalOficial: null,
    requerimentos: [
      "Permissão de organização para leitura e escrita de documentos e planilhas",
      "Conta corporativa autorizada pelo proprietário",
    ],
    integracaoReal: false,
    observacao: "Provedor corporativo real; sem permissão de organização validada.",
  },
  {
    id: "trae",
    nome: "TRAE",
    canalOficial: null,
    requerimentos: [
      "Sessão autenticada do operador no ambiente autorizado",
      "Autorização para edição de código e execução de comandos",
    ],
    integracaoReal: false,
    observacao: "Agente de desenvolvimento real; sem sessão autorizada neste ambiente.",
  },
  {
    id: "manus",
    nome: "Manus",
    canalOficial: null,
    requerimentos: [
      "Autorização de execução autônoma com limites de escopo definidos",
      "Credencial/conta fornecida pelo proprietário",
    ],
    integracaoReal: false,
    observacao: "Provedor de execução autônoma real; sem autorização de execução validada.",
  },
  {
    id: "fire_private_ai",
    nome: "FIRE Private AI",
    canalOficial: null,
    requerimentos: [
      "Disponibilização do FIRE Private AI pelo proprietário (ainda não disponível)",
      "Infraestrutura e credenciais privadas fornecidas pelo proprietário",
    ],
    integracaoReal: false,
    observacao: "Aguardando disponibilização; nenhuma instância privada foi ativada.",
  },
  {
    id: "custom",
    nome: "Agentes personalizados (cadastro do operador)",
    canalOficial: null,
    requerimentos: [
      "Cadastro do agente personalizado pelo operador",
      "Nenhuma credencial adicional: opera exclusivamente em fluxo manual assistido",
    ],
    integracaoReal: true,
    observacao: "Único caminho utilizável hoje, junto ao executor local, sem credencial de terceiros.",
  },
];

// Integrações REALMENTE disponíveis SEM credencial adicional neste ambiente.
// Na prática, apenas o fluxo manual/personalizado ("custom") e o executor local
// (execução determinística no navegador) — nenhum provedor externo.
export const INTEGRACOES_REAIS_DISPONIVEIS: string[] = ["custom", "executor_local"];

// Demais integrações: dependem de autorização e credencial do proprietário e
// permanecem pendentes até verificação real.
export const INTEGRACOES_PENDENTES: string[] = [
  "chatgpt",
  "codex",
  "work",
  "trae",
  "manus",
  "fire_private_ai",
];
