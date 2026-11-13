// =====================================================================
// FIRE Agent Command Center — LAB-004
// Roteador server-side (framework-agnóstico).
//
// `handleRequest(request, deps)` recebe um ApiRequest já normalizado e devolve
// um ApiResponse. É aqui que a segurança é aplicada de fato: rate limiting,
// autenticação, autorização e validação — antes de qualquer efeito.
// =====================================================================

import { lerConfig, resumoPublico, type ConfiguracaoServidor } from "./config";
import { ApiError, json, lerBearer, type ApiRequest, type ApiResponse } from "./http";
import { chaveDeRateLimit, Limitador, LIMITE_AUTENTICACAO, LIMITE_PADRAO } from "./rateLimit";
import {
  autenticarComSenha,
  autenticarRequisicao,
  cancelarExecucao,
  concluirExecucao,
  criarMissao,
  criarOrganizacao,
  criarUsuario,
  decidirAprovacao,
  enfileirarExecucao,
  exigirPermissao,
  listarAprovacoes,
  listarAuditoria,
  listarEvidencias,
  listarMissoes,
  listarRuns,
  listarUsuarios,
  processarFila,
  registrarEvidencia,
  verificarEvidencia,
  type Contexto,
} from "./servico";
import {
  validarAtivacaoProvedor,
  validarCriarMissao,
  validarCriarOrganizacao,
  validarCriarUsuario,
  validarDecisaoAprovacao,
  validarEnfileirarExecucao,
  validarLogin,
  validarProvedorId,
  validarRegistrarEvidencia,
} from "./esquema";
import { RepositorioMemoria, type Repositorio } from "./store";
import { RepositorioSupabase, criarClienteAuth, supabaseConfigurado } from "./supabase";
import { AdaptadorGitHub, type ResultadoGitHub } from "./integracoes/github";
import { AdaptadorVercel } from "./integracoes/vercel";
import { GerenciadorLeases, processarComRecuperacao } from "./orquestracaoPersistente";
import {
  AGENTES_CONHECIDOS,
  criarGatewayPadrao,
  montarEnvelope,
  validarEnvelope,
  type GatewayAgentes,
} from "./protocolo";
import { montarCentralConexoes, type EstadoConexoes } from "./conexoes";
import { capacidadeOAuth } from "./auth";
import { PreferenciasProvedores } from "./preferencias";

export interface DependenciasServidor {
  config: ConfiguracaoServidor;
  repo: Repositorio;
  leases: GerenciadorLeases;
  gateway: GatewayAgentes;
  github: AdaptadorGitHub;
  vercel: AdaptadorVercel;
  limitador: Limitador;
  limitadorAuth: Limitador;
  preferencias: PreferenciasProvedores;
}

export interface OpcoesDependencias {
  repo?: Repositorio;
  github?: AdaptadorGitHub;
  vercel?: AdaptadorVercel;
  relogio?: () => number;
  preferencias?: PreferenciasProvedores;
}

export function criarDependencias(config: ConfiguracaoServidor = lerConfig(), opcoes: OpcoesDependencias = {}): DependenciasServidor {
  const repo =
    opcoes.repo ??
    (supabaseConfigurado(config.supabase)
      ? new RepositorioSupabase(config.supabase)
      : new RepositorioMemoria());

  return {
    config,
    repo,
    leases: new GerenciadorLeases(undefined, opcoes.relogio),
    gateway: criarGatewayPadrao(),
    github:
      opcoes.github ??
      new AdaptadorGitHub({ token: config.github.token, repositorioAutorizado: config.github.repositorioAutorizado }),
    vercel:
      opcoes.vercel ??
      new AdaptadorVercel({
        token: config.vercel.token,
        projetoAutorizado: config.vercel.projetoAutorizado,
        teamId: config.vercel.teamId,
      }),
    limitador: new Limitador(LIMITE_PADRAO, opcoes.relogio),
    limitadorAuth: new Limitador(LIMITE_AUTENTICACAO, opcoes.relogio),
    preferencias: opcoes.preferencias ?? new PreferenciasProvedores(),
  };
}

function contexto(deps: DependenciasServidor): Contexto {
  return { repo: deps.repo, config: deps.config };
}

function normalizarCaminho(path: string): string {
  const semQuery = path.split("?")[0];
  const limpo = semQuery.replace(/\/+$/, "");
  return limpo === "" ? "/" : limpo;
}

async function estadoConexoes(deps: DependenciasServidor): Promise<EstadoConexoes> {
  const estadoSupabase = deps.repo.modo === "supabase" ? (deps.repo as RepositorioSupabase).estado() : "nao_configurado";
  const descricao = deps.repo.descrever();
  return montarCentralConexoes({
    config: deps.config,
    modoRepositorio: descricao.modo,
    persistente: descricao.persistente,
    mensagemRepositorio: descricao.mensagem,
    estadoSupabase,
    estadoGitHub: deps.github.estadoAtual(),
    estadoVercel: deps.vercel.estadoAtual(),
    provedoresDesativados: deps.preferencias.listar(),
  });
}

// Recusa operações em provedores desativados pelo operador — antes da rede.
function exigirProvedorAtivo(deps: DependenciasServidor, id: string): void {
  if (deps.preferencias.estaDesativado(id)) {
    throw new ApiError(
      "indisponivel",
      "Provedor desativado pelo operador no servidor: nenhuma chamada externa é realizada."
    );
  }
}

/* ------------------------------------------------------------------ */
/* Rotas                                                               */
/* ------------------------------------------------------------------ */

export async function handleRequest(req: ApiRequest, deps: DependenciasServidor): Promise<ApiResponse> {
  const path = normalizarCaminho(req.path);
  const metodo = req.method.toUpperCase();
  const ctx = contexto(deps);

  // Rate limiting global (rotas sensíveis têm cota própria, aplicada adiante).
  const limiteGlobal = deps.limitador.verificar(chaveDeRateLimit(req.ip, `${metodo} ${path}`));
  if (!limiteGlobal.permitido) {
    return json(
      429,
      { erro: "limite_excedido", mensagem: "Muitas requisições. Tente novamente em instantes." },
      { "retry-after": String(Math.ceil(limiteGlobal.redefinirEmMs / 1000)) }
    );
  }

  try {
    return await despachar(req, deps, ctx, path, metodo);
  } catch (erro) {
    if (erro instanceof ApiError) return erro.toResponse();
    // Nunca vaza stack/segredos: registro interno fica no console do servidor.
    console.error("[api] erro interno:", erro instanceof Error ? erro.message : erro);
    return json(500, { erro: "erro_interno", mensagem: "Erro interno do servidor." });
  }
}

async function despachar(
  req: ApiRequest,
  deps: DependenciasServidor,
  ctx: Contexto,
  path: string,
  metodo: string
): Promise<ApiResponse> {
  /* ---- Público ---- */
  if (metodo === "GET" && path === "/saude") {
    return json(200, { ok: true, ambiente: deps.config.ambiente, hora: new Date().toISOString() });
  }

  // Estado PÚBLICO e somente-leitura da Central de Conexões. Não contém
  // segredos (apenas presença booleana de configuração + estado honesto) e
  // permite que qualquer verificador independente confira os estados reais
  // sem credenciais. Operações sensíveis (testar/ativar) continuam exigindo
  // autenticação e permissão.
  if (metodo === "GET" && path === "/conexoes/publico") {
    return json(200, {
      ambiente: deps.config.ambiente,
      geradoEm: new Date().toISOString(),
      conexoes: await estadoConexoes(deps),
    });
  }

  if (metodo === "POST" && path === "/auth/login") {
    const limiter = deps.limitadorAuth.verificar(chaveDeRateLimit(req.ip, "login"));
    if (!limiter.permitido) {
      return json(429, { erro: "limite_excedido", mensagem: "Tentativas demais. Aguarde antes de tentar novamente." });
    }
    const dados = validarLogin(req.body);
    const resultado = await autenticarComSenha(ctx, dados.email, dados.senha);
    return json(200, {
      token: resultado.token,
      expiraEm: resultado.expiraEm,
      usuario: resultado.usuario,
    });
  }

  /* ---- Autenticado ---- */
  const identidade = await autenticarRequisicao(ctx, lerBearer(req.headers));
  const usuario = identidade.usuario;

  if (metodo === "GET" && path === "/auth/sessao") {
    return json(200, { autenticado: true, usuario });
  }

  if (metodo === "POST" && path === "/auth/logout") {
    // Sessão é stateless; o logout invalida o token no cliente. Registramos.
    return json(200, { ok: true, mensagem: "Sessão encerrada no cliente." });
  }

  if (metodo === "GET" && path === "/config") {
    return json(200, {
      resumo: resumoPublico(deps.config),
      conexoes: await estadoConexoes(deps),
      oauth: [
        capacidadeOAuth("google", { googleClientId: deps.config.oauth.googleClientId }),
        capacidadeOAuth("microsoft", { microsoftClientId: deps.config.oauth.microsoftClientId }),
      ],
    });
  }

  /* ---- Organizações / usuários ---- */
  if (metodo === "GET" && path === "/organizacoes") {
    return json(200, { organizacoes: await deps.repo.listarOrganizacoes() });
  }
  if (metodo === "POST" && path === "/organizacoes") {
    const organizacao = await criarOrganizacao(ctx, usuario, validarCriarOrganizacao(req.body));
    return json(201, { organizacao });
  }
  if (metodo === "GET" && path === "/usuarios") {
    return json(200, { usuarios: await listarUsuarios(ctx, usuario) });
  }
  if (metodo === "POST" && path === "/usuarios") {
    const dados = validarCriarUsuario(req.body);
    const senha = (req.body as Record<string, unknown>).senha;
    const payload = typeof senha === "string" ? { ...dados, senha } : dados;
    return json(201, { usuario: await criarUsuario(ctx, usuario, payload) });
  }

  /* ---- Missões ---- */
  if (metodo === "GET" && path === "/missoes") {
    return json(200, { missoes: await listarMissoes(ctx, usuario) });
  }
  if (metodo === "POST" && path === "/missoes") {
    const missao = await criarMissao(ctx, usuario, validarCriarMissao(req.body));
    return json(201, { missao });
  }

  /* ---- Execuções ---- */
  if (metodo === "GET" && path === "/execucoes") {
    return json(200, { execucoes: await listarRuns(ctx, usuario) });
  }
  if (metodo === "POST" && path === "/execucoes") {
    const resultado = await enfileirarExecucao(ctx, usuario, validarEnfileirarExecucao(req.body));
    return json(resultado.criado ? 201 : 200, { execucao: resultado.run, criado: resultado.criado });
  }
  if (metodo === "POST" && path === "/execucoes/cancelar") {
    const id = textoDe(req.body, "id");
    return json(200, { execucao: await cancelarExecucao(ctx, usuario, id) });
  }
  if (metodo === "POST" && path === "/execucoes/aprovar") {
    return json(200, { execucao: await decidirAprovacao(ctx, usuario, validarDecisaoAprovacao(req.body)) });
  }
  if (metodo === "POST" && path === "/execucoes/processar") {
    exigirPermissao(usuario, "missao:executar", usuario.organizacaoId);
    const ciclo = await processarComRecuperacao(ctx, deps.leases);
    return json(200, {
      iniciados: ciclo.iniciados,
      recuperados: ciclo.recuperados,
      expirados: ciclo.expirados,
      aguardandoBackoff: ciclo.aguardandoBackoff,
      mensagens: ciclo.mensagens,
      leasesAtivos: deps.leases.ativos().map((l) => l.runId),
    });
  }
  if (metodo === "POST" && path === "/execucoes/processar-simples") {
    exigirPermissao(usuario, "missao:executar", usuario.organizacaoId);
    return json(200, await processarFila(ctx));
  }
  if (metodo === "POST" && path === "/execucoes/concluir") {
    const obj = req.body as Record<string, unknown>;
    const id = textoDe(obj, "id");
    const resultado = obj.resultado as Record<string, unknown> | undefined;
    if (!resultado || typeof resultado.resumo !== "string") {
      throw new ApiError("requisicao_invalida", 'O campo "resultado.resumo" é obrigatório.');
    }
    const run = await concluirExecucao(ctx, usuario, id, {
      resumo: String(resultado.resumo).slice(0, 2000),
      checksum: String(resultado.checksum ?? "").slice(0, 200),
      verificacao: { passou: resultado.verificacao === undefined, detalhe: "Informado via API." },
    });
    return json(200, { execucao: run });
  }

  /* ---- Aprovações / auditoria / evidências ---- */
  if (metodo === "GET" && path === "/aprovacoes") {
    return json(200, { aprovacoes: await listarAprovacoes(ctx, usuario) });
  }
  if (metodo === "GET" && path === "/auditoria") {
    const limite = Number(req.query.limite ?? "200");
    return json(200, { auditoria: await listarAuditoria(ctx, usuario, Number.isFinite(limite) ? limite : 200) });
  }
  if (metodo === "GET" && path === "/evidencias") {
    return json(200, { evidencias: await listarEvidencias(ctx, usuario) });
  }
  if (metodo === "POST" && path === "/evidencias") {
    return json(201, { evidencia: await registrarEvidencia(ctx, usuario, validarRegistrarEvidencia(req.body)) });
  }
  if (metodo === "POST" && path === "/evidencias/verificar") {
    const id = textoDe(req.body, "id");
    return json(200, { evidencia: await verificarEvidencia(ctx, usuario, id) });
  }

  /* ---- Integrações (Central de Conexões) ---- */
  if (metodo === "GET" && path === "/integracoes") {
    return json(200, await estadoConexoes(deps));
  }
  if (metodo === "POST" && path === "/integracoes/testar") {
    exigirPermissao(usuario, "integracao:autorizar", usuario.organizacaoId);
    const { id } = validarProvedorId(req.body);
    exigirProvedorAtivo(deps, id);
    return json(200, await testarProvedor(deps, id));
  }
  if (metodo === "POST" && path === "/integracoes/ativacao") {
    exigirPermissao(usuario, "integracao:autorizar", usuario.organizacaoId);
    const { id, ativo } = validarAtivacaoProvedor(req.body);
    if (ativo) deps.preferencias.ativar(id);
    else deps.preferencias.desativar(id);
    return json(200, { id, ativo, conexoes: await estadoConexoes(deps) });
  }
  if (metodo === "POST" && path === "/integracoes/github/verificar-evidencia") {
    exigirPermissao(usuario, "evidencia:verificar", usuario.organizacaoId);
    exigirProvedorAtivo(deps, "github");
    const obj = req.body as Record<string, unknown>;
    const tipo = String(obj.tipo ?? "");
    const referencia = textoDe(obj, "referencia");
    if (tipo !== "commit" && tipo !== "branch" && tipo !== "pull_request") {
      throw new ApiError("requisicao_invalida", 'O campo "tipo" deve ser commit, branch ou pull_request.');
    }
    const resultado = await deps.github.verificarEvidencia(tipo, referencia);
    return json(200, resultado);
  }

  /* ---- Agentes (protocolo + gateway) ---- */
  if (metodo === "GET" && path === "/agentes") {
    return json(200, {
      protocolo: "fire-agent/1",
      agentes: deps.gateway.listar(AGENTES_CONHECIDOS),
    });
  }
  if (metodo === "POST" && path === "/agentes/enviar") {
    exigirPermissao(usuario, "missao:executar", usuario.organizacaoId);
    const obj = req.body as Record<string, unknown>;
    const agenteId = textoDe(obj, "agenteId");
    const envelope = obj.envelope;
    const validacao = validarEnvelope(envelope);
    if (!validacao.valido) {
      throw new ApiError("requisicao_invalida", `Envelope inválido: ${validacao.motivos.join("; ")}.`);
    }
    const resultado = await deps.gateway.enviar(agenteId, envelope as never);
    return json(200, resultado);
  }
  if (metodo === "POST" && path === "/agentes/envelope") {
    // Monta o envelope padronizado a partir de uma missão persistida.
    const obj = req.body as Record<string, unknown>;
    const missaoId = textoDe(obj, "missaoId");
    const missao = await deps.repo.buscarMissao(usuario.organizacaoId, missaoId);
    if (!missao) throw new ApiError("nao_encontrado", "Missão não encontrada nesta organização.");
    const runId = typeof obj.runId === "string" ? obj.runId : null;
    const run = runId ? await deps.repo.buscarRun(usuario.organizacaoId, runId) : null;
    return json(200, {
      envelope: montarEnvelope({
        missao,
        run,
        contexto: typeof obj.contexto === "string" ? obj.contexto.slice(0, 4000) : "",
      }),
    });
  }

  throw new ApiError("nao_encontrado", `Rota não encontrada: ${metodo} ${path}.`);
}

function textoDe(corpo: unknown, campo: string): string {
  if (corpo === null || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new ApiError("requisicao_invalida", "O corpo da requisição deve ser um objeto JSON.");
  }
  const valor = (corpo as Record<string, unknown>)[campo];
  if (typeof valor !== "string" || valor.trim().length === 0) {
    throw new ApiError("requisicao_invalida", `O campo "${campo}" é obrigatório.`);
  }
  return valor.trim();
}

interface ResultadoTeste {
  id: string;
  estado: string;
  ok: boolean;
  mensagem: string;
  detalhe: Record<string, unknown> | null;
}

// Testa a conexão REAL de um provedor autorizado. Nenhum provedor é marcado
// "conectado" sem uma chamada bem-sucedida.
async function testarProvedor(deps: DependenciasServidor, id: string): Promise<ResultadoTeste> {
  if (id === "github") {
    const repo = deps.config.github.repositorioAutorizado;
    const resultado: ResultadoGitHub<unknown> = await deps.github.verificarRepositorio(repo);
    return {
      id,
      estado: deps.github.estadoAtual(),
      ok: resultado.ok,
      mensagem: resultado.ok ? "Repositório autorizado acessível (chamada real bem-sucedida)." : resultado.mensagem,
      detalhe: resultado.dados ? { repositorio: repo } : null,
    };
  }
  if (id === "vercel") {
    const resultado = await deps.vercel.verificarProjeto();
    return {
      id,
      estado: deps.vercel.estadoAtual(),
      ok: resultado.ok,
      mensagem: resultado.ok ? "Projeto autorizado acessível (chamada real bem-sucedida)." : resultado.mensagem,
      detalhe: resultado.dados ? { projeto: deps.config.vercel.projetoAutorizado } : null,
    };
  }
  if (id === "supabase") {
    if (deps.repo.modo !== "supabase") {
      return {
        id,
        estado: "nao_configurado",
        ok: false,
        mensagem: "Supabase não configurado: nenhuma chamada foi feita.",
        detalhe: null,
      };
    }
    const verificacao = await (deps.repo as RepositorioSupabase).verificarConexao();
    return {
      id,
      estado: verificacao.estado,
      ok: verificacao.estado === "verificado",
      mensagem: verificacao.mensagem,
      detalhe: null,
    };
  }
  return {
    id,
    estado: "nao_configurado",
    ok: false,
    mensagem: "Provedor sem adaptador de verificação. Nenhuma chamada foi feita.",
    detalhe: null,
  };
}

/** Login via Supabase Auth (quando configurado). Não altera a sessão local. */
export function autenticacaoSupabaseDisponivel(config: ConfiguracaoServidor): boolean {
  return criarClienteAuth(config.supabase) !== null;
}
