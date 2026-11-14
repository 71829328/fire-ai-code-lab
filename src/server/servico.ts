// =====================================================================
// FIRE Agent Command Center — LAB-004
// Camada de serviço server-side.
//
// Concentra a lógica de negócio executada NO SERVIDOR: autenticação, validação
// de sessão, autorização (RBAC + isolamento por organização), persistência de
// missões/execuções, auditoria imutável e verificação de evidências.
//
// Nenhuma operação sensível confia em dados do cliente além do token de sessão
// assinado. A identidade e o papel são sempre relidos do repositório.
// =====================================================================

import { randomUUID } from "node:crypto";
import { autorizar } from "../platform/authz";
import type {
  Aprovacao,
  AuditEntry,
  EvidenceRecord,
  Organizacao,
  Permissao,
  Usuario,
} from "../platform/types";
import { criarEvidenceRecord, verificarIndependente } from "../evidence/center";
import {
  cancelar as cancelarRun,
  concluir as concluirRun,
  criarRun,
  enfileirar,
  processar,
  resolverAprovacao,
  type ProcessarParams,
} from "../orchestration/engine";
import type { EngineConfig, MissionRun, RunResultado } from "../orchestration/types";
import { DEFAULT_ENGINE_CONFIG } from "../orchestration/types";
import type { ConfiguracaoServidor } from "./config";
import { criarSessao, validarSessao, verificarSenha, type SessaoPayload } from "./auth";
import { ApiError } from "./http";
import type { MissaoServidor, Repositorio, UsuarioServidor } from "./store";
import type {
  AprovacaoValidada,
  EvidenciaValidada,
  ExecucaoValidada,
  MissaoValidada,
  OrganizacaoValidada,
  UsuarioValidado,
} from "./esquema";

export interface Contexto {
  repo: Repositorio;
  config: ConfiguracaoServidor;
  agora?: () => string;
}

function agora(ctx: Contexto): string {
  return (ctx.agora ?? (() => new Date().toISOString()))();
}

function novoId(prefixo: string): string {
  return `${prefixo}-${randomUUID()}`;
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

async function auditar(
  ctx: Contexto,
  organizacaoId: string,
  usuarioId: string | null,
  acao: string,
  recurso: string,
  recursoId: string | null,
  resultado: AuditEntry["resultado"],
  detalhe?: string
): Promise<void> {
  await ctx.repo.registrarAuditoria({
    id: novoId("au"),
    organizacaoId,
    usuarioId,
    acao,
    recurso,
    recursoId,
    resultado,
    detalhe,
    timestamp: agora(ctx),
  });
}

/* ------------------------------------------------------------------ */
/* Autenticação e sessão                                               */
/* ------------------------------------------------------------------ */

export interface ResultadoAutenticacao {
  token: string;
  usuario: Usuario;
  expiraEm: string;
}

export async function autenticarComSenha(
  ctx: Contexto,
  email: string,
  senha: string
): Promise<ResultadoAutenticacao> {
  const usuario = await ctx.repo.buscarUsuarioPorEmail(email);
  // Resposta genérica: não revela se o e-mail existe.
  const invalido = new ApiError("nao_autenticado", "Credenciais inválidas.");

  if (!usuario) {
    await auditar(ctx, "desconhecida", null, "tentou autenticar", "sessao", null, "negado", "Usuário inexistente.");
    throw invalido;
  }
  if (!usuario.ativo) {
    await auditar(ctx, usuario.organizacaoId, usuario.id, "tentou autenticar", "sessao", null, "negado", "Usuário inativo.");
    throw invalido;
  }
  if (!usuario.senhaHash || !verificarSenha(senha, usuario.senhaHash)) {
    await auditar(ctx, usuario.organizacaoId, usuario.id, "tentou autenticar", "sessao", null, "negado", "Senha incorreta.");
    throw invalido;
  }

  const token = criarSessao(
    {
      sub: usuario.id,
      org: usuario.organizacaoId,
      papel: usuario.papel,
      nome: usuario.nome,
      email: usuario.email,
      agoraMs: Date.parse(agora(ctx)),
    },
    ctx.config.sessao.segredo
  );

  await auditar(ctx, usuario.organizacaoId, usuario.id, "autenticou", "sessao", null, "permitido");
  const { senhaHash: _senhaHash, ...publico } = usuario;
  const validacao = validarSessao(token, ctx.config.sessao.segredo, Date.parse(agora(ctx)));
  return {
    token,
    usuario: publico,
    expiraEm: validacao.ok ? new Date(validacao.payload.exp).toISOString() : agora(ctx),
  };
}

export interface IdentidadeAutenticada {
  usuario: Usuario;
  sessao: SessaoPayload;
}

// Valida o token E reconfere o usuário no repositório. Uma sessão válida de um
// usuário desativado (ou cujo papel/org mudou) é rejeitada — a verdade está no
// servidor, não no token.
export async function autenticarRequisicao(ctx: Contexto, token: string | null): Promise<IdentidadeAutenticada> {
  const resultado = validarSessao(token, ctx.config.sessao.segredo, Date.parse(agora(ctx)));
  if (!resultado.ok) {
    const codigo = resultado.motivo === "segredo_ausente" ? "indisponivel" : "sessao_invalida";
    const mensagem =
      resultado.motivo === "segredo_ausente"
        ? "Autenticação indisponível: segredo de sessão não configurado."
        : "Sessão inválida ou expirada.";
    throw new ApiError(codigo, mensagem);
  }
  const usuarioCompleto = await ctx.repo.buscarUsuario(resultado.payload.sub);
  if (!usuarioCompleto || !usuarioCompleto.ativo) {
    throw new ApiError("sessao_invalida", "Sessão inválida: usuário inexistente ou inativo.");
  }
  if (usuarioCompleto.organizacaoId !== resultado.payload.org) {
    // A organização da sessão não corresponde mais à do usuário: sessão revogada.
    throw new ApiError("sessao_invalida", "Sessão inválida: organização divergente.");
  }
  const { senhaHash: _senhaHash, ...publico } = usuarioCompleto;
  return {
    usuario: { ...publico, papel: usuarioCompleto.papel },
    sessao: { ...resultado.payload, papel: usuarioCompleto.papel },
  };
}

/* ------------------------------------------------------------------ */
/* Autorização                                                         */
/* ------------------------------------------------------------------ */

export function exigirPermissao(usuario: Usuario, permissao: Permissao, organizacaoId: string): void {
  const decisao = autorizar(usuario, permissao, organizacaoId);
  if (!decisao.permitido) {
    throw new ApiError("sem_permissao", decisao.motivo);
  }
}

/* ------------------------------------------------------------------ */
/* Organizações e usuários                                             */
/* ------------------------------------------------------------------ */

export async function criarOrganizacao(
  ctx: Contexto,
  usuario: Usuario,
  dados: OrganizacaoValidada
): Promise<Organizacao> {
  exigirPermissao(usuario, "organizacao:gerenciar", usuario.organizacaoId);
  const organizacao: Organizacao = {
    id: novoId("org"),
    nome: dados.nome,
    ambiente: dados.ambiente,
    criadoEm: agora(ctx),
  };
  const criada = await ctx.repo.criarOrganizacao(organizacao);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "criou organização", "organizacao", criada.id, "permitido", criada.nome);
  return criada;
}

export async function criarUsuario(
  ctx: Contexto,
  usuario: Usuario,
  dados: UsuarioValidado | (UsuarioValidado & { senha: string })
): Promise<Usuario> {
  exigirPermissao(usuario, "usuario:gerenciar", usuario.organizacaoId);
  const existente = await ctx.repo.buscarUsuarioPorEmail(dados.email);
  if (existente) {
    throw new ApiError("conflito", "Já existe um usuário com este e-mail.");
  }
  const { gerarHashSenha } = await import("./auth");
  const senha = "senha" in dados && typeof dados.senha === "string" && dados.senha.length >= 6 ? dados.senha : null;
  const novo: UsuarioServidor = {
    id: novoId("us"),
    organizacaoId: usuario.organizacaoId,
    nome: dados.nome,
    email: dados.email,
    papel: dados.papel,
    ativo: true,
    criadoEm: agora(ctx),
    senhaHash: senha ? gerarHashSenha(senha) : "",
  };
  const criado = await ctx.repo.criarUsuario(novo);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "criou usuário", "usuario", criado.id, "permitido", criado.nome);
  return criado;
}

export async function listarUsuarios(ctx: Contexto, usuario: Usuario): Promise<Usuario[]> {
  exigirPermissao(usuario, "usuario:gerenciar", usuario.organizacaoId);
  return ctx.repo.listarUsuarios(usuario.organizacaoId);
}

/* ------------------------------------------------------------------ */
/* Missões                                                             */
/* ------------------------------------------------------------------ */

export async function criarMissao(
  ctx: Contexto,
  usuario: Usuario,
  dados: MissaoValidada
): Promise<MissaoServidor> {
  exigirPermissao(usuario, "missao:criar", usuario.organizacaoId);
  const existentes = await ctx.repo.listarMissoes(usuario.organizacaoId);
  if (existentes.some((m) => m.codigo === dados.codigo)) {
    throw new ApiError("conflito", "Já existe uma missão com este código nesta organização.");
  }
  const missao: MissaoServidor = {
    id: novoId("msn"),
    organizacaoId: usuario.organizacaoId,
    codigo: dados.codigo,
    titulo: dados.titulo,
    objetivo: dados.objetivo,
    instrucoes: dados.instrucoes,
    prioridade: dados.prioridade,
    status: "pendente",
    dependencias: dados.dependencias,
    agenteId: null,
    criteriosAceite: dados.criteriosAceite,
    criadoEm: agora(ctx),
  };
  const criada = await ctx.repo.criarMissao(missao);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "criou missão", "missao", criada.id, "permitido", criada.codigo);
  return criada;
}

export async function listarMissoes(ctx: Contexto, usuario: Usuario): Promise<MissaoServidor[]> {
  return ctx.repo.listarMissoes(usuario.organizacaoId);
}

/* ------------------------------------------------------------------ */
/* Execuções                                                           */
/* ------------------------------------------------------------------ */

export async function enfileirarExecucao(
  ctx: Contexto,
  usuario: Usuario,
  dados: ExecucaoValidada
): Promise<{ run: MissionRun; criado: boolean }> {
  exigirPermissao(usuario, "missao:executar", usuario.organizacaoId);
  const missao = await ctx.repo.buscarMissao(usuario.organizacaoId, dados.missaoId);
  if (!missao) throw new ApiError("nao_encontrado", "Missão não encontrada nesta organização.");

  const run = criarRun({
    organizacaoId: usuario.organizacaoId,
    missao,
    agenteId: missao.agenteId,
    criticidade: dados.criticidade,
    chaveIdempotencia: dados.chaveIdempotencia ?? `${usuario.organizacaoId}:${missao.id}`,
    agora: agora(ctx),
  });

  const runs = await ctx.repo.listarRuns(usuario.organizacaoId);
  const resultado = enfileirar(runs, run);
  if (!resultado.criado) {
    await auditar(ctx, usuario.organizacaoId, usuario.id, "enfileirou execução", "run", resultado.existenteId, "info", "Ignorado por idempotência.");
    const existente = await ctx.repo.buscarRun(usuario.organizacaoId, resultado.existenteId ?? "");
    return { run: existente ?? run, criado: false };
  }
  await ctx.repo.salvarRun(run);
  if (dados.criticidade === "critica") {
    await solicitarAprovacao(ctx, usuario, missao, run);
  }
  await auditar(ctx, usuario.organizacaoId, usuario.id, "enfileirou execução", "run", run.id, "permitido", run.missaoCodigo);
  return { run, criado: true };
}

async function solicitarAprovacao(
  ctx: Contexto,
  usuario: Usuario,
  missao: MissaoServidor,
  run: MissionRun
): Promise<Aprovacao> {
  const aprovacao: Aprovacao = {
    id: novoId("apv"),
    organizacaoId: usuario.organizacaoId,
    missaoId: missao.id,
    runId: run.id,
    criticidade: "critica",
    decisao: "pendente",
    solicitadoPor: usuario.id,
    decididoPor: null,
    justificativa: "",
    solicitadoEm: agora(ctx),
    decididoEm: null,
  };
  await ctx.repo.adicionarAprovacao(aprovacao);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "solicitou aprovação", "aprovacao", aprovacao.id, "info", missao.codigo);
  return aprovacao;
}

export interface ResultadoProcessamento {
  runs: MissionRun[];
  iniciados: string[];
  concluidos: string[];
  expirados: string[];
  mensagens: string[];
}

// Executa UM ciclo do motor no servidor. As missões vêm do repositório (nunca
// do cliente) e as aprovações concedidas são relidas do banco.
export async function processarFila(
  ctx: Contexto,
  organizacaoId: string,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG
): Promise<ResultadoProcessamento> {
  // O escopo vem da sessão verificada pelo servidor, nunca do corpo da requisição.
  const organizacao = await ctx.repo.buscarOrganizacao(organizacaoId);
  if (!organizacao) throw new ApiError("nao_encontrado", "Organização autenticada não encontrada.");

  const acumulado: ResultadoProcessamento = { runs: [], iniciados: [], concluidos: [], expirados: [], mensagens: [] };
  const runs = await ctx.repo.listarRuns(organizacao.id);
  if (runs.length === 0) return acumulado;

  const missoes = await ctx.repo.listarMissoes(organizacao.id);
  const aprovacoes = await ctx.repo.listarAprovacoes(organizacao.id);
  const aprovadas = new Set(
    aprovacoes.filter((a) => a.decisao === "aprovado" && a.runId).map((a) => a.runId as string)
  );

  const params: ProcessarParams = {
    runs,
    missoes,
    config,
    agora: agora(ctx),
    aprovadas,
  };
  const passo = processar(params);
  for (const run of passo.runs) {
    const anterior = runs.find((r) => r.id === run.id);
    if (anterior?.status !== run.status) await ctx.repo.salvarRun(run);
  }
  acumulado.runs.push(...passo.runs);
  acumulado.iniciados.push(...passo.iniciados);
  acumulado.expirados.push(...passo.expirados);
  acumulado.mensagens.push(...passo.mensagens);
  return acumulado;
}

export async function listarRuns(ctx: Contexto, usuario: Usuario): Promise<MissionRun[]> {
  return ctx.repo.listarRuns(usuario.organizacaoId);
}

export async function cancelarExecucao(ctx: Contexto, usuario: Usuario, runId: string): Promise<MissionRun> {
  exigirPermissao(usuario, "missao:cancelar", usuario.organizacaoId);
  const run = await ctx.repo.buscarRun(usuario.organizacaoId, runId);
  if (!run) throw new ApiError("nao_encontrado", "Execução não encontrada nesta organização.");
  const cancelada = cancelarRun(run, agora(ctx));
  await ctx.repo.salvarRun(cancelada);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "cancelou execução", "run", runId, "permitido");
  return cancelada;
}

export async function concluirExecucao(
  ctx: Contexto,
  usuario: Usuario,
  runId: string,
  resultado: RunResultado
): Promise<MissionRun> {
  exigirPermissao(usuario, "missao:executar", usuario.organizacaoId);
  const run = await ctx.repo.buscarRun(usuario.organizacaoId, runId);
  if (!run) throw new ApiError("nao_encontrado", "Execução não encontrada nesta organização.");
  const concluida = concluirRun(run, resultado, agora(ctx));
  await ctx.repo.salvarRun(concluida);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "concluiu execução", "run", runId, "permitido");
  return concluida;
}

export async function decidirAprovacao(
  ctx: Contexto,
  usuario: Usuario,
  dados: AprovacaoValidada
): Promise<MissionRun> {
  exigirPermissao(usuario, "missao:aprovar", usuario.organizacaoId);
  const run = await ctx.repo.buscarRun(usuario.organizacaoId, dados.runId);
  if (!run) throw new ApiError("nao_encontrado", "Execução não encontrada nesta organização.");

  const momento = agora(ctx);
  const atualizada = resolverAprovacao(run, dados.aprovado, momento, dados.justificativa);
  await ctx.repo.salvarRun(atualizada);

  const aprovacoes = await ctx.repo.listarAprovacoes(usuario.organizacaoId);
  const pendente = aprovacoes.find((a) => a.runId === dados.runId && a.decisao === "pendente");
  if (pendente) {
    await ctx.repo.atualizarAprovacao({
      ...pendente,
      decisao: dados.aprovado ? "aprovado" : "rejeitado",
      decididoPor: usuario.id,
      decididoEm: momento,
      justificativa: dados.justificativa || pendente.justificativa,
    });
  }
  await auditar(
    ctx,
    usuario.organizacaoId,
    usuario.id,
    dados.aprovado ? "aprovou execução" : "rejeitou execução",
    "run",
    dados.runId,
    "permitido"
  );
  return atualizada;
}

export async function listarAprovacoes(ctx: Contexto, usuario: Usuario): Promise<Aprovacao[]> {
  exigirPermissao(usuario, "auditoria:ler", usuario.organizacaoId);
  return ctx.repo.listarAprovacoes(usuario.organizacaoId);
}

/* ------------------------------------------------------------------ */
/* Evidências                                                          */
/* ------------------------------------------------------------------ */

export async function registrarEvidencia(
  ctx: Contexto,
  usuario: Usuario,
  dados: EvidenciaValidada
): Promise<EvidenceRecord> {
  exigirPermissao(usuario, "evidencia:registrar", usuario.organizacaoId);
  if (dados.missaoId) {
    const missao = await ctx.repo.buscarMissao(usuario.organizacaoId, dados.missaoId);
    if (!missao) throw new ApiError("nao_encontrado", "Missão referenciada não pertence a esta organização.");
  }
  const evidencia = criarEvidenceRecord({
    organizacaoId: usuario.organizacaoId,
    tipo: dados.tipo,
    referencia: dados.referencia,
    descricao: dados.descricao,
    valor: dados.valor,
    missaoId: dados.missaoId,
    runId: dados.runId,
    origemDado: dados.origemDado,
    registradoPor: usuario.id,
    agora: agora(ctx),
  });
  await ctx.repo.adicionarEvidencia(evidencia);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "registrou evidência", "evidencia", evidencia.id, "permitido", evidencia.referencia);
  return evidencia;
}

export async function verificarEvidencia(
  ctx: Contexto,
  usuario: Usuario,
  evidenciaId: string
): Promise<EvidenceRecord> {
  exigirPermissao(usuario, "evidencia:verificar", usuario.organizacaoId);
  const evidencias = await ctx.repo.listarEvidencias(usuario.organizacaoId);
  const alvo = evidencias.find((e) => e.id === evidenciaId);
  if (!alvo) throw new ApiError("nao_encontrado", "Evidência não encontrada nesta organização.");
  const verificada = verificarIndependente(alvo, usuario.nome, agora(ctx));
  await ctx.repo.atualizarEvidencia(verificada);
  await auditar(ctx, usuario.organizacaoId, usuario.id, "verificou evidência", "evidencia", evidenciaId, "permitido");
  return verificada;
}

export async function listarEvidencias(ctx: Contexto, usuario: Usuario): Promise<EvidenceRecord[]> {
  return ctx.repo.listarEvidencias(usuario.organizacaoId);
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

export async function listarAuditoria(ctx: Contexto, usuario: Usuario, limite = 200): Promise<AuditEntry[]> {
  exigirPermissao(usuario, "auditoria:ler", usuario.organizacaoId);
  const teto = Math.min(Math.max(limite, 1), 500);
  return ctx.repo.listarAuditoria(usuario.organizacaoId, teto);
}
