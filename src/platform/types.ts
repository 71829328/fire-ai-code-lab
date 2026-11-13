// Núcleo operacional do FIRE Agent Command Center (LAB-003).
//
// Esta camada é DESACOPLADA do estado demonstrativo (v2). Ela representa os
// conceitos que só passam a existir quando a central opera de verdade:
// organizações, usuários, papéis, permissões, aprovações, auditoria, consumo e
// registros de evidência verificada.
//
// Regra de honestidade: nada aqui inventa conexão, custo ou desempenho. Campos
// de custo são "informados" pelo operador; conexões exigem verificação real.

export type Papel = "proprietario" | "administrador" | "operador" | "revisor" | "observador";

export const PAPEL_LABEL: Record<Papel, string> = {
  proprietario: "Proprietário",
  administrador: "Administrador",
  operador: "Operador",
  revisor: "Revisor",
  observador: "Observador",
};

export type Permissao =
  | "organizacao:gerenciar"
  | "usuario:gerenciar"
  | "agente:gerenciar"
  | "projeto:gerenciar"
  | "missao:criar"
  | "missao:executar"
  | "missao:aprovar"
  | "missao:cancelar"
  | "evidencia:registrar"
  | "evidencia:verificar"
  | "integracao:autorizar"
  | "auditoria:ler"
  | "backup:gerenciar"
  | "consumo:ler";

// Matriz de permissões por papel. Menor privilégio por padrão.
export const PERMISSOES_POR_PAPEL: Record<Papel, Permissao[]> = {
  proprietario: [
    "organizacao:gerenciar",
    "usuario:gerenciar",
    "agente:gerenciar",
    "projeto:gerenciar",
    "missao:criar",
    "missao:executar",
    "missao:aprovar",
    "missao:cancelar",
    "evidencia:registrar",
    "evidencia:verificar",
    "integracao:autorizar",
    "auditoria:ler",
    "backup:gerenciar",
    "consumo:ler",
  ],
  administrador: [
    "usuario:gerenciar",
    "agente:gerenciar",
    "projeto:gerenciar",
    "missao:criar",
    "missao:executar",
    "missao:aprovar",
    "missao:cancelar",
    "evidencia:registrar",
    "evidencia:verificar",
    "integracao:autorizar",
    "auditoria:ler",
    "consumo:ler",
  ],
  operador: [
    "missao:criar",
    "missao:executar",
    "missao:cancelar",
    "evidencia:registrar",
    "consumo:ler",
  ],
  revisor: ["missao:aprovar", "evidencia:registrar", "evidencia:verificar", "auditoria:ler"],
  observador: ["auditoria:ler"],
};

export interface Organizacao {
  id: string;
  nome: string;
  criadoEm: string;
  // Ambiente lógico (demonstração/homologação/produção). Nunca "produção" por padrão.
  ambiente: "demonstracao" | "homologacao" | "producao";
}

export interface Usuario {
  id: string;
  organizacaoId: string;
  nome: string;
  email: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
}

/* ------------------------------------------------------------------ */
/* Auditoria e consumo                                                 */
/* ------------------------------------------------------------------ */

export interface AuditEntry {
  id: string;
  organizacaoId: string;
  usuarioId: string | null;
  acao: string;
  recurso: string;
  recursoId: string | null;
  resultado: "permitido" | "negado" | "info";
  detalhe?: string;
  timestamp: string;
}

export interface UsageMetric {
  id: string;
  organizacaoId: string;
  // Identificação da origem do consumo. "informado" significa digitado pelo operador.
  provedorId: string;
  agenteId: string | null;
  missaoId: string | null;
  runId: string | null;
  unidade: string; // ex.: "tokens", "minutos", "requisicoes"
  quantidade: number;
  custoEstimado: number; // em unidades da moeda informada; nunca calculado por API paga
  moeda: string;
  origemDado: OrigemDado;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Aprovações                                                          */
/* ------------------------------------------------------------------ */

export type Criticidade = "normal" | "critica";
export type DecisaoAprovacao = "pendente" | "aprovado" | "rejeitado";

export interface Aprovacao {
  id: string;
  organizacaoId: string;
  missaoId: string;
  runId: string | null;
  criticidade: Criticidade;
  decisao: DecisaoAprovacao;
  solicitadoPor: string | null;
  decididoPor: string | null;
  justificativa: string;
  solicitadoEm: string;
  decididoEm: string | null;
}

/* ------------------------------------------------------------------ */
/* Evidências estruturadas (central de evidências)                     */
/* ------------------------------------------------------------------ */

export type EvidenceKind =
  | "repositorio"
  | "branch"
  | "commit"
  | "pull_request"
  | "deployment"
  | "teste"
  | "captura"
  | "relatorio"
  | "arquivo"
  | "bloqueio";

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  repositorio: "Repositório",
  branch: "Branch",
  commit: "Commit",
  pull_request: "Pull request",
  deployment: "Deployment",
  teste: "Teste",
  captura: "Captura de tela",
  relatorio: "Relatório",
  arquivo: "Arquivo",
  bloqueio: "Bloqueio",
};

export type OrigemDado = "informado_agente" | "informado_operador" | "verificado_independente";

export const ORIGEM_DADO_LABEL: Record<OrigemDado, string> = {
  informado_agente: "Informado pelo agente",
  informado_operador: "Informado pelo operador",
  verificado_independente: "Verificado independentemente",
};

export interface EvidenceRecord {
  id: string;
  organizacaoId: string;
  missaoId: string | null;
  runId: string | null;
  tipo: EvidenceKind;
  referencia: string; // ex.: URL do PR, hash do commit, nome do arquivo
  descricao: string;
  valor: string;
  origemDado: OrigemDado;
  registradoPor: string | null;
  verificadoPor: string | null;
  verificadoEm: string | null;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/* Migrações (metadados espelhando os arquivos SQL)                    */
/* ------------------------------------------------------------------ */

export interface Migracao {
  versao: string; // ex.: "0001"
  nome: string;
  arquivo: string; // caminho em backend/migrations
  descricao: string;
  aplicada: boolean; // sempre false nesta entrega (sem banco real)
}

/* ------------------------------------------------------------------ */
/* Estado da camada de plataforma                                      */
/* ------------------------------------------------------------------ */

export interface PlatformState {
  versao: number;
  organizacaoAtivaId: string;
  organizacoes: Organizacao[];
  usuarios: Usuario[];
  usuarioAtivoId: string;
  aprovacoes: Aprovacao[];
  auditoria: AuditEntry[];
  consumo: UsageMetric[];
  evidencias: EvidenceRecord[];
  migracoes: Migracao[];
}

export const PLATFORM_STATE_VERSION = 1;
