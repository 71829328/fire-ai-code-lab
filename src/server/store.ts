// =====================================================================
// FIRE Agent Command Center — LAB-004
// Repositório server-side.
//
// A camada de serviço conversa com uma interface (`Repositorio`) e não sabe se
// o armazenamento é em memória ou Supabase. Duas implementações coexistem:
//   - RepositorioMemoria  → funcional, usado em desenvolvimento e testes;
//   - RepositorioSupabase → adaptador REST real (src/server/supabase.ts),
//     ativado SOMENTE com credenciais configuradas. Sem credenciais, permanece
//     explicitamente DESCONECTADO.
//
// Registros de auditoria são APPEND-ONLY: a interface não expõe update/delete.
// =====================================================================

import type { MissionRun } from "../orchestration/types";
import type { MissionView } from "../orchestration/types";
import type {
  Aprovacao,
  AuditEntry,
  EvidenceRecord,
  Organizacao,
  Papel,
  Usuario,
  UsageMetric,
} from "../platform/types";
import { gerarHashSenha } from "./auth";

/** Usuário com material de credencial — NUNCA serializado para o cliente. */
export interface UsuarioServidor extends Usuario {
  senhaHash: string;
}

/** Missão na projeção usada pelo motor, vinculada à sua organização. */
export interface MissaoServidor extends MissionView {
  organizacaoId: string;
  objetivo: string;
  criadoEm: string;
}

export interface EstadoServidor {
  organizacoes: Organizacao[];
  usuarios: UsuarioServidor[];
  missoes: MissaoServidor[];
  runs: MissionRun[];
  aprovacoes: Aprovacao[];
  auditoria: AuditEntry[];
  evidencias: EvidenceRecord[];
  consumo: UsageMetric[];
}

export interface Repositorio {
  readonly modo: "memoria" | "supabase";
  readonly persistente: boolean;
  descrever(): { modo: string; persistente: boolean; mensagem: string };

  listarOrganizacoes(): Promise<Organizacao[]>;
  buscarOrganizacao(id: string): Promise<Organizacao | null>;
  criarOrganizacao(org: Organizacao): Promise<Organizacao>;

  listarUsuarios(organizacaoId: string): Promise<Usuario[]>;
  buscarUsuario(id: string): Promise<UsuarioServidor | null>;
  buscarUsuarioPorEmail(email: string): Promise<UsuarioServidor | null>;
  criarUsuario(usuario: UsuarioServidor): Promise<Usuario>;

  listarMissoes(organizacaoId: string): Promise<MissaoServidor[]>;
  buscarMissao(organizacaoId: string, id: string): Promise<MissaoServidor | null>;
  criarMissao(missao: MissaoServidor): Promise<MissaoServidor>;

  listarRuns(organizacaoId: string): Promise<MissionRun[]>;
  buscarRun(organizacaoId: string, id: string): Promise<MissionRun | null>;
  salvarRun(run: MissionRun): Promise<void>;

  listarAuditoria(organizacaoId: string, limite: number): Promise<AuditEntry[]>;
  registrarAuditoria(entrada: AuditEntry): Promise<void>;

  listarEvidencias(organizacaoId: string): Promise<EvidenceRecord[]>;
  adicionarEvidencia(evidencia: EvidenceRecord): Promise<EvidenceRecord>;
  atualizarEvidencia(evidencia: EvidenceRecord): Promise<void>;

  listarAprovacoes(organizacaoId: string): Promise<Aprovacao[]>;
  adicionarAprovacao(aprovacao: Aprovacao): Promise<Aprovacao>;
  atualizarAprovacao(aprovacao: Aprovacao): Promise<void>;

  listarConsumo(organizacaoId: string): Promise<UsageMetric[]>;
}

/* ------------------------------------------------------------------ */
/* Semente                                                            */
/* ------------------------------------------------------------------ */

/** Senha de demonstração — usada APENAS fora de produção (dev/teste). */
export const SENHA_DEMO = "fire-demo-2026";

export const ORG_DEMO_ID = "org-demo";
export const ORG_LAB_ID = "org-homolog";

export function criarEstadoServidorSeed(producao = false): EstadoServidor {
  const agora = new Date().toISOString();
  const organizacoes: Organizacao[] = [
    { id: ORG_DEMO_ID, nome: "FIRE Intelligence — Demonstração", criadoEm: agora, ambiente: "demonstracao" },
    { id: ORG_LAB_ID, nome: "Laboratório de Homologação", criadoEm: agora, ambiente: "homologacao" },
  ];

  // Em produção não semeamos usuários com senha conhecida: credenciais reais
  // são provisionadas fora do código.
  const usuarios: UsuarioServidor[] = producao
    ? []
    : [
        usuarioSeed("us-owner", ORG_DEMO_ID, "Operador FIRE", "operador@exemplo.invalid", "proprietario", agora),
        usuarioSeed("us-op", ORG_DEMO_ID, "Analista de Execução", "operacao@exemplo.invalid", "operador", agora),
        usuarioSeed("us-rev", ORG_DEMO_ID, "Revisor Técnico", "revisao@exemplo.invalid", "revisor", agora),
        usuarioSeed("us-obs", ORG_DEMO_ID, "Observador", "observador@exemplo.invalid", "observador", agora),
      ];

  return {
    organizacoes,
    usuarios,
    missoes: [],
    runs: [],
    aprovacoes: [],
    auditoria: [],
    evidencias: [],
    consumo: [],
  };
}

function usuarioSeed(
  id: string,
  organizacaoId: string,
  nome: string,
  email: string,
  papel: Papel,
  agora: string
): UsuarioServidor {
  return {
    id,
    organizacaoId,
    nome,
    email,
    papel,
    ativo: true,
    criadoEm: agora,
    senhaHash: gerarHashSenha(SENHA_DEMO),
  };
}

/* ------------------------------------------------------------------ */
/* Repositório em memória                                             */
/* ------------------------------------------------------------------ */

export class RepositorioMemoria implements Repositorio {
  readonly modo = "memoria" as const;
  readonly persistente = false;
  private estado: EstadoServidor;

  constructor(estado: EstadoServidor = criarEstadoServidorSeed()) {
    this.estado = estado;
  }

  descrever() {
    return {
      modo: this.modo,
      persistente: this.persistente,
      mensagem:
        "Repositório em memória: dados válidos apenas durante a vida da instância. Persistência durável exige Supabase configurado.",
    };
  }

  async listarOrganizacoes(): Promise<Organizacao[]> {
    return this.estado.organizacoes.map((o) => ({ ...o }));
  }

  async buscarOrganizacao(id: string): Promise<Organizacao | null> {
    return this.estado.organizacoes.find((o) => o.id === id) ?? null;
  }

  async criarOrganizacao(org: Organizacao): Promise<Organizacao> {
    this.estado.organizacoes.push({ ...org });
    return { ...org };
  }

  async listarUsuarios(organizacaoId: string): Promise<Usuario[]> {
    return this.estado.usuarios
      .filter((u) => u.organizacaoId === organizacaoId)
      .map(({ senhaHash: _senhaHash, ...usuario }) => usuario);
  }

  async buscarUsuario(id: string): Promise<UsuarioServidor | null> {
    return this.estado.usuarios.find((u) => u.id === id) ?? null;
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioServidor | null> {
    const alvo = email.trim().toLowerCase();
    return this.estado.usuarios.find((u) => u.email.toLowerCase() === alvo) ?? null;
  }

  async criarUsuario(usuario: UsuarioServidor): Promise<Usuario> {
    this.estado.usuarios.push({ ...usuario });
    const { senhaHash: _senhaHash, ...publico } = usuario;
    return publico;
  }

  async listarMissoes(organizacaoId: string): Promise<MissaoServidor[]> {
    return this.estado.missoes.filter((m) => m.organizacaoId === organizacaoId).map((m) => ({ ...m }));
  }

  async buscarMissao(organizacaoId: string, id: string): Promise<MissaoServidor | null> {
    return this.estado.missoes.find((m) => m.id === id && m.organizacaoId === organizacaoId) ?? null;
  }

  async criarMissao(missao: MissaoServidor): Promise<MissaoServidor> {
    this.estado.missoes.push({ ...missao });
    return { ...missao };
  }

  async listarRuns(organizacaoId: string): Promise<MissionRun[]> {
    return this.estado.runs.filter((r) => r.organizacaoId === organizacaoId).map((r) => ({ ...r }));
  }

  async buscarRun(organizacaoId: string, id: string): Promise<MissionRun | null> {
    return this.estado.runs.find((r) => r.id === id && r.organizacaoId === organizacaoId) ?? null;
  }

  async salvarRun(run: MissionRun): Promise<void> {
    const indice = this.estado.runs.findIndex((r) => r.id === run.id);
    if (indice >= 0) this.estado.runs[indice] = { ...run };
    else this.estado.runs.unshift({ ...run });
  }

  async listarAuditoria(organizacaoId: string, limite: number): Promise<AuditEntry[]> {
    return this.estado.auditoria.filter((a) => a.organizacaoId === organizacaoId).slice(0, limite);
  }

  async registrarAuditoria(entrada: AuditEntry): Promise<void> {
    this.estado.auditoria.unshift({ ...entrada });
  }

  async listarEvidencias(organizacaoId: string): Promise<EvidenceRecord[]> {
    return this.estado.evidencias.filter((e) => e.organizacaoId === organizacaoId).map((e) => ({ ...e }));
  }

  async adicionarEvidencia(evidencia: EvidenceRecord): Promise<EvidenceRecord> {
    this.estado.evidencias.unshift({ ...evidencia });
    return { ...evidencia };
  }

  async atualizarEvidencia(evidencia: EvidenceRecord): Promise<void> {
    const indice = this.estado.evidencias.findIndex((e) => e.id === evidencia.id);
    if (indice >= 0) this.estado.evidencias[indice] = { ...evidencia };
  }

  async listarAprovacoes(organizacaoId: string): Promise<Aprovacao[]> {
    return this.estado.aprovacoes.filter((a) => a.organizacaoId === organizacaoId).map((a) => ({ ...a }));
  }

  async adicionarAprovacao(aprovacao: Aprovacao): Promise<Aprovacao> {
    this.estado.aprovacoes.unshift({ ...aprovacao });
    return { ...aprovacao };
  }

  async atualizarAprovacao(aprovacao: Aprovacao): Promise<void> {
    const indice = this.estado.aprovacoes.findIndex((a) => a.id === aprovacao.id);
    if (indice >= 0) this.estado.aprovacoes[indice] = { ...aprovacao };
  }

  async listarConsumo(organizacaoId: string): Promise<UsageMetric[]> {
    return this.estado.consumo.filter((c) => c.organizacaoId === organizacaoId).map((c) => ({ ...c }));
  }
}
