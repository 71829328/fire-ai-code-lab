import { describe, expect, it } from "vitest";
import { criarSessao } from "./auth";
import { lerConfig } from "./config";
import { validarCriarMissao } from "./esquema";
import { ApiError } from "./http";
import {
  autenticarComSenha,
  autenticarRequisicao,
  criarMissao,
  criarUsuario,
  enfileirarExecucao,
  exigirPermissao,
  listarMissoes,
  registrarEvidencia,
  verificarEvidencia,
  type Contexto,
} from "./servico";
import {
  criarEstadoServidorSeed,
  ORG_DEMO_ID,
  ORG_LAB_ID,
  RepositorioMemoria,
  SENHA_DEMO,
} from "./store";

const SEGREDO = "segredo-teste";
const config = lerConfig({ FIRE_SESSION_SECRET: SEGREDO });

function novoContexto(): { ctx: Contexto; repo: RepositorioMemoria } {
  const repo = new RepositorioMemoria();
  return { ctx: { repo, config }, repo };
}

async function erroDe(promessa: Promise<unknown>, codigo: string): Promise<void> {
  try {
    await promessa;
    throw new Error("esperava ApiError");
  } catch (erro) {
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).codigo).toBe(codigo);
  }
}

describe("autenticação por senha", () => {
  it("autentica credencial válida e não devolve o hash da senha", async () => {
    const { ctx } = novoContexto();
    const resultado = await autenticarComSenha(ctx, "operador@exemplo.invalid", SENHA_DEMO);
    expect(resultado.token.startsWith("v1.")).toBe(true);
    expect(resultado.usuario).not.toHaveProperty("senhaHash");
    expect(resultado.usuario.papel).toBe("proprietario");
  });

  it("rejeita senha incorreta e usuário inexistente com a MESMA resposta genérica", async () => {
    const { ctx } = novoContexto();
    await erroDe(autenticarComSenha(ctx, "operador@exemplo.invalid", "senha-errada-123"), "nao_autenticado");
    await erroDe(autenticarComSenha(ctx, "ninguem@exemplo.invalid", SENHA_DEMO), "nao_autenticado");
  });
});

describe("validação de sessão no servidor", () => {
  it("aceita sessão íntegra de usuário ativo", async () => {
    const { ctx } = novoContexto();
    const { token } = await autenticarComSenha(ctx, "operacao@exemplo.invalid", SENHA_DEMO);
    const identidade = await autenticarRequisicao(ctx, token);
    expect(identidade.usuario.papel).toBe("operador");
    expect(identidade.usuario.organizacaoId).toBe(ORG_DEMO_ID);
  });

  it("rejeita token adulterado", async () => {
    const { ctx } = novoContexto();
    await erroDe(autenticarRequisicao(ctx, "v1.aaa.bbb"), "sessao_invalida");
  });

  it("rejeita sessão de usuário INATIVO (verdade vem do repositório)", async () => {
    const estado = criarEstadoServidorSeed();
    estado.usuarios[0].ativo = false;
    const repo = new RepositorioMemoria(estado);
    const ctx: Contexto = { repo, config };
    const token = criarSessao(
      { sub: estado.usuarios[0].id, org: ORG_DEMO_ID, papel: "proprietario", nome: "x", email: estado.usuarios[0].email },
      SEGREDO
    );
    await erroDe(autenticarRequisicao(ctx, token), "sessao_invalida");
  });

  it("rejeita sessão cuja organização diverge da do usuário", async () => {
    const { ctx } = novoContexto();
    const token = criarSessao(
      { sub: "us-owner", org: ORG_LAB_ID, papel: "proprietario", nome: "x", email: "operador@exemplo.invalid" },
      SEGREDO
    );
    await erroDe(autenticarRequisicao(ctx, token), "sessao_invalida");
  });

  it("NÃO confia no papel declarado no token: relê do repositório", async () => {
    const { ctx } = novoContexto();
    // Token forjado com papel elevado (assinado com o segredo do servidor).
    const token = criarSessao(
      { sub: "us-obs", org: ORG_DEMO_ID, papel: "proprietario", nome: "Observador", email: "observador@exemplo.invalid" },
      SEGREDO
    );
    const identidade = await autenticarRequisicao(ctx, token);
    expect(identidade.usuario.papel).toBe("observador");
    expect(identidade.sessao.papel).toBe("observador");
  });

  it("indisponível quando o segredo do servidor não está configurado", async () => {
    const repo = new RepositorioMemoria();
    const ctx: Contexto = { repo, config: lerConfig({}) };
    await erroDe(autenticarRequisicao(ctx, null), "indisponivel");
  });
});

describe("autorização e escalada de privilégio", () => {
  it("observador não pode criar missão (menor privilégio)", async () => {
    const { ctx } = novoContexto();
    const observador = await ctx.repo.buscarUsuario("us-obs");
    expect(observador?.papel).toBe("observador");
    await erroDe(criarMissao(ctx, observador!, validarCriarMissao({ codigo: "X1", titulo: "Título", objetivo: "Objetivo" })), "sem_permissao");
  });

  it("exigirPermissao bloqueia operação fora do papel", () => {
    const observador = { id: "us-obs", organizacaoId: ORG_DEMO_ID, nome: "o", email: "e@x.invalid", papel: "observador" as const, ativo: true, criadoEm: "" };
    expect(() => exigirPermissao(observador, "integracao:autorizar", ORG_DEMO_ID)).toThrow(ApiError);
  });
});

describe("isolamento entre organizações", () => {
  it("um usuário nunca enxerga missões de outra organização", async () => {
    const { ctx, repo } = novoContexto();
    await repo.criarMissao({
      id: "msn-outra",
      organizacaoId: ORG_LAB_ID,
      codigo: "LAB-X",
      titulo: "Outra",
      prioridade: "media",
      status: "pendente",
      dependencias: [],
      agenteId: null,
      instrucoes: "",
      criteriosAceite: [],
      objetivo: "segredo de outro tenant",
      criadoEm: new Date().toISOString(),
    });
    const operador = await ctx.repo.buscarUsuario("us-op");
    const missoes = await listarMissoes(ctx, operador!);
    expect(missoes).toHaveLength(0);
  });
});

describe("missões, idempotência e evidências", () => {
  it("rejeita código de missão duplicado na mesma organização", async () => {
    const { ctx } = novoContexto();
    const dono = await ctx.repo.buscarUsuario("us-owner");
    const dados = validarCriarMissao({ codigo: "LAB-9", titulo: "Título", objetivo: "Objetivo" });
    await criarMissao(ctx, dono!, dados);
    await erroDe(criarMissao(ctx, dono!, dados), "conflito");
  });

  it("enfileiramento é idempotente (não cria duas execuções para a mesma chave)", async () => {
    const { ctx } = novoContexto();
    const dono = await ctx.repo.buscarUsuario("us-owner");
    const missao = await criarMissao(ctx, dono!, validarCriarMissao({ codigo: "LAB-7", titulo: "Título", objetivo: "Objetivo" }));
    const primeira = await enfileirarExecucao(ctx, dono!, { missaoId: missao.id, criticidade: "normal", chaveIdempotencia: null });
    const segunda = await enfileirarExecucao(ctx, dono!, { missaoId: missao.id, criticidade: "normal", chaveIdempotencia: null });
    expect(primeira.criado).toBe(true);
    expect(segunda.criado).toBe(false);
    expect(segunda.run.id).toBe(primeira.run.id);
  });

  it("operação crítica gera aprovação pendente", async () => {
    const { ctx } = novoContexto();
    const dono = await ctx.repo.buscarUsuario("us-owner");
    const missao = await criarMissao(ctx, dono!, validarCriarMissao({ codigo: "LAB-8", titulo: "Título", objetivo: "Objetivo" }));
    const { run } = await enfileirarExecucao(ctx, dono!, { missaoId: missao.id, criticidade: "critica", chaveIdempotencia: null });
    const aprovacoes = await ctx.repo.listarAprovacoes(ORG_DEMO_ID);
    expect(aprovacoes.some((a) => a.runId === run.id && a.decisao === "pendente")).toBe(true);
  });

  it("evidência só vira 'verificada' via rota de verificação, com verificador real", async () => {
    const { ctx } = novoContexto();
    const revisor = await ctx.repo.buscarUsuario("us-rev");
    const ev = await registrarEvidencia(ctx, revisor!, {
      tipo: "commit",
      referencia: "abc123",
      descricao: "commit do agente",
      valor: "",
      missaoId: null,
      runId: null,
      origemDado: "informado_agente",
    });
    expect(ev.origemDado).toBe("informado_agente");
    expect(ev.verificadoPor).toBeNull();

    const verificada = await verificarEvidencia(ctx, revisor!, ev.id);
    expect(verificada.origemDado).toBe("verificado_independente");
    expect(verificada.verificadoPor).toBe("Revisor Técnico");
  });
});

describe("auditoria (append-only)", () => {
  it("registra ações e nunca expõe credenciais", async () => {
    const { ctx } = novoContexto();
    const dono = await ctx.repo.buscarUsuario("us-owner");
    await criarMissao(ctx, dono!, validarCriarMissao({ codigo: "LAB-AUD", titulo: "Título", objetivo: "Objetivo" }));
    const registro = await ctx.repo.listarAuditoria(ORG_DEMO_ID, 50);
    expect(registro.length).toBeGreaterThan(0);
    expect(JSON.stringify(registro)).not.toContain(SENHA_DEMO);
  });
});

describe("gestão de usuários", () => {
  it("cria usuário autenticável e impede email duplicado", async () => {
    const { ctx } = novoContexto();
    const dono = await ctx.repo.buscarUsuario("us-owner");
    const criado = await criarUsuario(ctx, dono!, {
      nome: "Novo Operador",
      email: "novo@exemplo.invalid",
      papel: "operador",
      senha: "senha-nova-123",
    });
    expect(criado.email).toBe("novo@exemplo.invalid");
    const login = await autenticarComSenha(ctx, "novo@exemplo.invalid", "senha-nova-123");
    expect(login.usuario.id).toBe(criado.id);
    await erroDe(
      criarUsuario(ctx, dono!, { nome: "Novo 2", email: "novo@exemplo.invalid", papel: "operador", senha: "senha-nova-123" }),
      "conflito"
    );
  });
});
