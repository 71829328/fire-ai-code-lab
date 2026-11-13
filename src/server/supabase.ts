// =====================================================================
// FIRE Agent Command Center — LAB-004
// Adaptador Supabase (server-side).
//
// DUAS CAMADAS:
//   1. ClientePostgrest — acesso a dados via PostgREST (chave de serviço).
//   2. ClienteAuth      — login de e-mail/senha via GoTrue (chave anônima).
//
// REGRAS DE SEGURANÇA/ HONESTIDADE:
//   - As chaves vivem SOMENTE no servidor (variáveis de ambiente). Nunca são
//     enviadas ao cliente nem gravadas em logs.
//   - Sem credenciais, o estado é explicitamente "nao_configurado": nenhuma
//     chamada é feita e nenhuma conexão é declarada.
//   - "verificado" só é verdadeiro após uma chamada real bem-sucedida
//     (verificarConexao()). Aqui, entregamos o adaptador pronto e DESCONECTADO.
//   - A identidade confiável é a do token Supabase (auth.uid()). Este adaptador
//     NÃO cria caminhos alternativos de identidade.
// =====================================================================

import type { MissionRun, RunAttempt, RunEvento } from "../orchestration/types";
import type {
  Aprovacao,
  AuditEntry,
  EvidenceRecord,
  Organizacao,
  Papel,
  Usuario,
  UsageMetric,
} from "../platform/types";
import type { MissaoServidor, Repositorio, UsuarioServidor } from "./store";
import { fetchPadrao, type FetchLike } from "./rede";

export interface SupabaseConfig {
  url: string | null;
  anonKey: string | null;
  serviceRoleKey: string | null;
}

export type EstadoConexaoSupabase =
  | "nao_configurado"
  | "configurado_nao_verificado"
  | "verificado"
  | "erro";

export interface RetornoCliente {
  ok: boolean;
  status: number;
  dados: unknown;
  erro?: string;
}

export type { FetchLike } from "./rede";

/* ------------------------------------------------------------------ */
/* Cliente PostgREST                                                   */
/* ------------------------------------------------------------------ */

export class ClientePostgrest {
  constructor(
    private readonly url: string,
    private readonly chave: string,
    private readonly fetchImpl: FetchLike = fetchPadrao
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.chave,
      authorization: `Bearer ${this.chave}`,
      "content-type": "application/json",
      accept: "application/json",
      ...extra,
    };
  }

  private async executar(
    metodo: string,
    caminho: string,
    corpo?: unknown,
    headers: Record<string, string> = {}
  ): Promise<RetornoCliente> {
    const resposta = await this.fetchImpl(`${this.url}/rest/v1/${caminho}`, {
      method: metodo,
      headers: this.headers(headers),
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    const texto = await resposta.text();
    let dados: unknown = null;
    if (texto) {
      try {
        dados = JSON.parse(texto);
      } catch {
        dados = texto;
      }
    }
    if (!resposta.ok) {
      const mensagem =
        dados && typeof dados === "object" && "message" in (dados as Record<string, unknown>)
          ? String((dados as Record<string, unknown>).message)
          : `HTTP ${resposta.status}`;
      return { ok: false, status: resposta.status, dados, erro: mensagem };
    }
    return { ok: true, status: resposta.status, dados };
  }

  listar(tabela: string, filtros: Record<string, string> = {}, ordem?: string): Promise<RetornoCliente> {
    const params = new URLSearchParams({ select: "*", ...filtros });
    if (ordem) params.set("order", ordem);
    return this.executar("GET", `${tabela}?${params.toString()}`);
  }

  inserir(tabela: string, registros: Record<string, unknown> | Record<string, unknown>[]): Promise<RetornoCliente> {
    return this.executar("POST", tabela, registros, { prefer: "return=representation" });
  }

  atualizar(tabela: string, filtros: Record<string, string>, valores: Record<string, unknown>): Promise<RetornoCliente> {
    const params = new URLSearchParams(filtros);
    return this.executar("PATCH", `${tabela}?${params.toString()}`, valores, {
      prefer: "return=representation",
    });
  }
}

/* ------------------------------------------------------------------ */
/* Cliente GoTrue (autenticação)                                       */
/* ------------------------------------------------------------------ */

export interface RespostaLoginSupabase {
  ok: boolean;
  status: number;
  accessToken: string | null;
  expiraEmSegundos: number | null;
  usuario: { id: string; email: string | null } | null;
  erro?: string;
}

export class ClienteAuth {
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly fetchImpl: FetchLike = fetchPadrao
  ) {}

  // Login real por e-mail/senha (grant_type=password). Sem credenciais válidas,
  // devolve ok=false — nunca inventamos uma sessão.
  async loginComSenha(email: string, senha: string): Promise<RespostaLoginSupabase> {
    const resposta = await this.fetchImpl(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password: senha }),
    });
    const texto = await resposta.text();
    let dados: Record<string, unknown> | null = null;
    if (texto) {
      try {
        dados = JSON.parse(texto) as Record<string, unknown>;
      } catch {
        dados = null;
      }
    }
    if (!resposta.ok || !dados) {
      const erro =
        dados && typeof dados.error_description === "string"
          ? dados.error_description
          : `HTTP ${resposta.status}`;
      return { ok: false, status: resposta.status, accessToken: null, expiraEmSegundos: null, usuario: null, erro };
    }
    const usuarioBruto = dados.user as Record<string, unknown> | undefined;
    return {
      ok: true,
      status: resposta.status,
      accessToken: typeof dados.access_token === "string" ? dados.access_token : null,
      expiraEmSegundos: typeof dados.expires_in === "number" ? dados.expires_in : null,
      usuario:
        usuarioBruto && typeof usuarioBruto.id === "string"
          ? { id: usuarioBruto.id, email: typeof usuarioBruto.email === "string" ? usuarioBruto.email : null }
          : null,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Repositório Supabase                                                */
/* ------------------------------------------------------------------ */

function stringOuNulo(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function paraOrganizacao(linha: Record<string, unknown>): Organizacao {
  return {
    id: String(linha.id),
    nome: String(linha.nome ?? ""),
    criadoEm: String(linha.criado_em ?? new Date().toISOString()),
    ambiente: (linha.ambiente as Organizacao["ambiente"]) ?? "demonstracao",
  };
}

function paraUsuario(linha: Record<string, unknown>): Usuario {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    nome: String(linha.nome ?? ""),
    email: String(linha.email ?? ""),
    papel: (linha.papel as Papel) ?? "observador",
    ativo: linha.ativo !== false,
    criadoEm: String(linha.criado_em ?? new Date().toISOString()),
  };
}

function paraMissao(linha: Record<string, unknown>): MissaoServidor {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    codigo: String(linha.codigo ?? ""),
    titulo: String(linha.titulo ?? ""),
    objetivo: String(linha.objetivo ?? ""),
    instrucoes: String(linha.instrucoes ?? ""),
    prioridade: (linha.prioridade as MissaoServidor["prioridade"]) ?? "media",
    status: (linha.status as MissaoServidor["status"]) ?? "pendente",
    dependencias: [],
    agenteId: stringOuNulo(linha.agente_id),
    criteriosAceite: Array.isArray(linha.criterios_aceite) ? (linha.criterios_aceite as string[]) : [],
    criadoEm: String(linha.criado_em ?? new Date().toISOString()),
  };
}

function paraRun(linha: Record<string, unknown>): MissionRun {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    missaoId: String(linha.missao_id),
    missaoCodigo: String(linha.missao_codigo ?? ""),
    agenteId: stringOuNulo(linha.agente_id),
    prioridade: (linha.prioridade as MissionRun["prioridade"]) ?? "media",
    criticidade: (linha.criticidade as MissionRun["criticidade"]) ?? "normal",
    status: (linha.status as MissionRun["status"]) ?? "enfileirada",
    chaveIdempotencia: String(linha.chave_idempotencia ?? ""),
    tentativaAtual: Number(linha.tentativa_atual ?? 0),
    tentativas: [],
    eventos: [],
    criadoEm: String(linha.criado_em ?? new Date().toISOString()),
    atualizadoEm: String(linha.atualizado_em ?? new Date().toISOString()),
    iniciadoEm: stringOuNulo(linha.iniciado_em),
    finalizadoEm: stringOuNulo(linha.finalizado_em),
    resultado: null,
    erro: stringOuNulo(linha.erro),
  };
}

function paraEvidencia(linha: Record<string, unknown>): EvidenceRecord {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    missaoId: stringOuNulo(linha.missao_id),
    runId: stringOuNulo(linha.run_id),
    tipo: linha.tipo as EvidenceRecord["tipo"],
    referencia: String(linha.referencia ?? ""),
    descricao: String(linha.descricao ?? ""),
    valor: String(linha.valor ?? ""),
    origemDado: linha.origem_dado as EvidenceRecord["origemDado"],
    registradoPor: stringOuNulo(linha.registrado_por),
    verificadoPor: stringOuNulo(linha.verificado_por),
    verificadoEm: stringOuNulo(linha.verificado_em),
    timestamp: String(linha.timestamp ?? new Date().toISOString()),
  };
}

function paraAprovacao(linha: Record<string, unknown>): Aprovacao {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    missaoId: String(linha.missao_id),
    runId: stringOuNulo(linha.run_id),
    criticidade: (linha.criticidade as Aprovacao["criticidade"]) ?? "normal",
    decisao: (linha.decisao as Aprovacao["decisao"]) ?? "pendente",
    solicitadoPor: stringOuNulo(linha.solicitado_por),
    decididoPor: stringOuNulo(linha.decidido_por),
    justificativa: String(linha.justificativa ?? ""),
    solicitadoEm: String(linha.solicitado_em ?? new Date().toISOString()),
    decididoEm: stringOuNulo(linha.decidido_em),
  };
}

function paraAuditoria(linha: Record<string, unknown>): AuditEntry {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    usuarioId: stringOuNulo(linha.usuario_id),
    acao: String(linha.acao ?? ""),
    recurso: String(linha.recurso ?? ""),
    recursoId: stringOuNulo(linha.recurso_id),
    resultado: (linha.resultado as AuditEntry["resultado"]) ?? "info",
    detalhe: typeof linha.detalhe === "string" ? linha.detalhe : undefined,
    timestamp: String(linha.timestamp ?? new Date().toISOString()),
  };
}

function paraConsumo(linha: Record<string, unknown>): UsageMetric {
  return {
    id: String(linha.id),
    organizacaoId: String(linha.organizacao_id),
    provedorId: String(linha.provedor_id ?? "desconhecido"),
    agenteId: stringOuNulo(linha.agente_id),
    missaoId: stringOuNulo(linha.missao_id),
    runId: stringOuNulo(linha.run_id),
    unidade: String(linha.unidade ?? "unidades"),
    quantidade: Number(linha.quantidade ?? 0),
    custoEstimado: Number(linha.custo_estimado ?? 0),
    moeda: String(linha.moeda ?? "BRL"),
    origemDado: (linha.origem_dado as UsageMetric["origemDado"]) ?? "informado_operador",
    timestamp: String(linha.timestamp ?? new Date().toISOString()),
  };
}

export class RepositorioSupabase implements Repositorio {
  readonly modo = "supabase" as const;
  readonly persistente = true;
  private estadoConexao: EstadoConexaoSupabase = "configurado_nao_verificado";

  constructor(
    private readonly config: SupabaseConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike
  ) {}

  private cliente(): ClientePostgrest {
    if (!this.config.url || !this.config.serviceRoleKey) {
      throw new Error("Supabase não configurado: url/chave de serviço ausentes.");
    }
    return new ClientePostgrest(this.config.url, this.config.serviceRoleKey, this.fetchImpl);
  }

  estado(): EstadoConexaoSupabase {
    return this.estadoConexao;
  }

  /** Chamada real de verificação. Só marca "verificado" com resposta 2xx. */
  async verificarConexao(): Promise<{ estado: EstadoConexaoSupabase; mensagem: string }> {
    if (!this.config.url || !this.config.serviceRoleKey) {
      this.estadoConexao = "nao_configurado";
      return { estado: this.estadoConexao, mensagem: "Sem url/chave de serviço: conexão não tentada." };
    }
    try {
      const retorno = await this.cliente().listar("organizacoes", { select: "id", limit: "1" });
      if (retorno.ok) {
        this.estadoConexao = "verificado";
        return { estado: this.estadoConexao, mensagem: "Conexão verificada com sucesso (chamada real 2xx)." };
      }
      this.estadoConexao = "erro";
      return { estado: this.estadoConexao, mensagem: `Falha na verificação: ${retorno.erro ?? "erro desconhecido"}` };
    } catch (erro) {
      this.estadoConexao = "erro";
      const mensagem = erro instanceof Error ? erro.message : "erro desconhecido";
      return { estado: this.estadoConexao, mensagem: `Falha na verificação: ${mensagem}` };
    }
  }

  descrever() {
    return {
      modo: this.modo,
      persistente: this.persistente,
      mensagem: "Persistência durável via Supabase (PostgREST). Estado da conexão: verificar /config.",
    };
  }

  async listarOrganizacoes(): Promise<Organizacao[]> {
    const r = await this.cliente().listar("organizacoes", {}, "criado_em.asc");
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraOrganizacao);
  }

  async buscarOrganizacao(id: string): Promise<Organizacao | null> {
    const r = await this.cliente().listar("organizacoes", { id: `eq.${id}`, limit: "1" });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraOrganizacao(linha) : null;
  }

  async criarOrganizacao(org: Organizacao): Promise<Organizacao> {
    const r = await this.cliente().inserir("organizacoes", {
      id: org.id,
      nome: org.nome,
      ambiente: org.ambiente,
    });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraOrganizacao(linha) : org;
  }

  async listarUsuarios(organizacaoId: string): Promise<Usuario[]> {
    const r = await this.cliente().listar("usuarios", { organizacao_id: `eq.${organizacaoId}` });
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraUsuario);
  }

  async buscarUsuario(id: string): Promise<UsuarioServidor | null> {
    const r = await this.cliente().listar("usuarios", { id: `eq.${id}`, limit: "1" });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    // Sem coluna de senha no schema: a autenticação por senha é feita pelo
    // GoTrue (ClienteAuth). O hash fica vazio — nunca é usado aqui.
    return linha ? { ...paraUsuario(linha), senhaHash: "" } : null;
  }

  async buscarUsuarioPorEmail(email: string): Promise<UsuarioServidor | null> {
    const r = await this.cliente().listar("usuarios", { email: `eq.${email.trim().toLowerCase()}`, limit: "1" });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? { ...paraUsuario(linha), senhaHash: "" } : null;
  }

  async criarUsuario(usuario: UsuarioServidor): Promise<Usuario> {
    const r = await this.cliente().inserir("usuarios", {
      id: usuario.id,
      organizacao_id: usuario.organizacaoId,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel,
      ativo: usuario.ativo,
    });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraUsuario(linha) : usuario;
  }

  async listarMissoes(organizacaoId: string): Promise<MissaoServidor[]> {
    const r = await this.cliente().listar("missoes", { organizacao_id: `eq.${organizacaoId}` });
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraMissao);
  }

  async buscarMissao(organizacaoId: string, id: string): Promise<MissaoServidor | null> {
    const r = await this.cliente().listar("missoes", { organizacao_id: `eq.${organizacaoId}`, id: `eq.${id}`, limit: "1" });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraMissao(linha) : null;
  }

  async criarMissao(missao: MissaoServidor): Promise<MissaoServidor> {
    const r = await this.cliente().inserir("missoes", {
      id: missao.id,
      organizacao_id: missao.organizacaoId,
      codigo: missao.codigo,
      titulo: missao.titulo,
      objetivo: missao.objetivo,
      instrucoes: missao.instrucoes,
      status: missao.status,
      prioridade: missao.prioridade,
      criterios_aceite: missao.criteriosAceite,
    });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraMissao(linha) : missao;
  }

  private async carregarFilhos(run: MissionRun): Promise<FilhosRun> {
    const [attempts, eventos] = await Promise.all([
      this.cliente().listar("run_attempts", { run_id: `eq.${run.id}` }, "numero.asc"),
      this.cliente().listar("run_eventos", { run_id: `eq.${run.id}` }, "timestamp.asc"),
    ]);
    return {
      tentativas: Array.isArray(attempts.dados) ? (attempts.dados as Record<string, unknown>[]).map(paraAttempt) : [],
      eventos: Array.isArray(eventos.dados) ? (eventos.dados as Record<string, unknown>[]).map(paraEvento) : [],
    };
  }

  async listarRuns(organizacaoId: string): Promise<MissionRun[]> {
    const r = await this.cliente().listar("mission_runs", { organizacao_id: `eq.${organizacaoId}` }, "criado_em.desc");
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraRun);
  }

  async buscarRun(organizacaoId: string, id: string): Promise<MissionRun | null> {
    const r = await this.cliente().listar("mission_runs", { organizacao_id: `eq.${organizacaoId}`, id: `eq.${id}`, limit: "1" });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    if (!linha) return null;
    const run = paraRun(linha);
    const filhos = await this.carregarFilhos(run);
    return { ...run, tentativas: filhos.tentativas, eventos: filhos.eventos };
  }

  // Persiste a execução e APPENDA somente os filhos novos (run_attempts e
  // run_eventos são append-only). Nunca atualiza/remove eventos existentes.
  async salvarRun(run: MissionRun): Promise<void> {
    await this.cliente().atualizar("mission_runs", { id: `eq.${run.id}` }, {
      status: run.status,
      tentativa_atual: run.tentativaAtual,
      agente_id: run.agenteId,
      erro: run.erro,
      atualizado_em: run.atualizadoEm,
      iniciado_em: run.iniciadoEm,
      finalizado_em: run.finalizadoEm,
      resultado: run.resultado,
    });

    const existentes = await this.carregarFilhos(run);
    const idsEventos = new Set(existentes.eventos.map((e) => e.id));
    const idsAttempts = new Set(existentes.tentativas.map((t) => `${t.numero}`));

    const novosEventos = run.eventos.filter((e) => !idsEventos.has(e.id));
    const novosAttempts = run.tentativas.filter((t) => !idsAttempts.has(`${t.numero}`));

    if (novosAttempts.length > 0) {
      await this.cliente().inserir(
        "run_attempts",
        novosAttempts.map((t) => ({
          run_id: run.id,
          numero: t.numero,
          inicio: t.inicio,
          fim: t.fim,
          status: t.status,
          erro: t.erro,
        }))
      );
    }
    if (novosEventos.length > 0) {
      await this.cliente().inserir(
        "run_eventos",
        novosEventos.map((e) => ({ run_id: run.id, status: e.status, descricao: e.descricao, timestamp: e.timestamp }))
      );
    }
  }

  async listarAuditoria(organizacaoId: string, limite: number): Promise<AuditEntry[]> {
    const r = await this.cliente().listar(
      "audit_log",
      { organizacao_id: `eq.${organizacaoId}`, limit: String(limite) },
      "timestamp.desc"
    );
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraAuditoria);
  }

  async registrarAuditoria(entrada: AuditEntry): Promise<void> {
    // Somente inserção: audit_log é imutável (trigger no banco).
    await this.cliente().inserir("audit_log", {
      id: entrada.id,
      organizacao_id: entrada.organizacaoId,
      usuario_id: entrada.usuarioId,
      acao: entrada.acao,
      recurso: entrada.recurso,
      recurso_id: entrada.recursoId,
      resultado: entrada.resultado,
      detalhe: entrada.detalhe ?? null,
    });
  }

  async listarEvidencias(organizacaoId: string): Promise<EvidenceRecord[]> {
    const r = await this.cliente().listar("evidencias", { organizacao_id: `eq.${organizacaoId}` }, "timestamp.desc");
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraEvidencia);
  }

  async adicionarEvidencia(evidencia: EvidenceRecord): Promise<EvidenceRecord> {
    const r = await this.cliente().inserir("evidencias", {
      id: evidencia.id,
      organizacao_id: evidencia.organizacaoId,
      missao_id: evidencia.missaoId,
      run_id: evidencia.runId,
      tipo: evidencia.tipo,
      referencia: evidencia.referencia,
      descricao: evidencia.descricao,
      valor: evidencia.valor,
      origem_dado: evidencia.origemDado,
      registrado_por: evidencia.registradoPor,
      verificado_por: evidencia.verificadoPor,
      verificado_em: evidencia.verificadoEm,
    });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraEvidencia(linha) : evidencia;
  }

  async atualizarEvidencia(evidencia: EvidenceRecord): Promise<void> {
    await this.cliente().atualizar("evidencias", { id: `eq.${evidencia.id}` }, {
      origem_dado: evidencia.origemDado,
      verificado_por: evidencia.verificadoPor,
      verificado_em: evidencia.verificadoEm,
    });
  }

  async listarAprovacoes(organizacaoId: string): Promise<Aprovacao[]> {
    const r = await this.cliente().listar("aprovacoes", { organizacao_id: `eq.${organizacaoId}` }, "solicitado_em.desc");
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraAprovacao);
  }

  async adicionarAprovacao(aprovacao: Aprovacao): Promise<Aprovacao> {
    const r = await this.cliente().inserir("aprovacoes", {
      id: aprovacao.id,
      organizacao_id: aprovacao.organizacaoId,
      missao_id: aprovacao.missaoId,
      run_id: aprovacao.runId,
      criticidade: aprovacao.criticidade,
      decisao: aprovacao.decisao,
      solicitado_por: aprovacao.solicitadoPor,
      justificativa: aprovacao.justificativa,
    });
    const linha = Array.isArray(r.dados) ? (r.dados as Record<string, unknown>[])[0] : null;
    return linha ? paraAprovacao(linha) : aprovacao;
  }

  async atualizarAprovacao(aprovacao: Aprovacao): Promise<void> {
    await this.cliente().atualizar("aprovacoes", { id: `eq.${aprovacao.id}` }, {
      decisao: aprovacao.decisao,
      decidido_por: aprovacao.decididoPor,
      decidido_em: aprovacao.decididoEm,
      justificativa: aprovacao.justificativa,
    });
  }

  async listarConsumo(organizacaoId: string): Promise<UsageMetric[]> {
    const r = await this.cliente().listar("usage_metrics", { organizacao_id: `eq.${organizacaoId}` }, "timestamp.desc");
    if (!r.ok || !Array.isArray(r.dados)) return [];
    return (r.dados as Record<string, unknown>[]).map(paraConsumo);
  }
}

interface FilhosRun {
  tentativas: RunAttempt[];
  eventos: RunEvento[];
}

function paraAttempt(linha: Record<string, unknown>): RunAttempt {
  return {
    numero: Number(linha.numero ?? 0),
    inicio: String(linha.inicio ?? ""),
    fim: stringOuNulo(linha.fim),
    status: (linha.status as RunAttempt["status"]) ?? "executando",
    erro: stringOuNulo(linha.erro),
    resultado: null,
  };
}

function paraEvento(linha: Record<string, unknown>): RunEvento {
  return {
    id: String(linha.id),
    status: linha.status as RunEvento["status"],
    descricao: String(linha.descricao ?? ""),
    timestamp: String(linha.timestamp ?? ""),
  };
}

/* ------------------------------------------------------------------ */

export function supabaseConfigurado(config: SupabaseConfig): boolean {
  return Boolean(config.url && config.anonKey);
}

export function criarClienteAuth(config: SupabaseConfig): ClienteAuth | null {
  if (!config.url || !config.anonKey) return null;
  return new ClienteAuth(config.url, config.anonKey);
}
