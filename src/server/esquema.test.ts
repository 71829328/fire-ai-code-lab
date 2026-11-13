import { describe, expect, it } from "vitest";
import { ApiError } from "./http";
import {
  validarCriarMissao,
  validarCriarOrganizacao,
  validarCriarUsuario,
  validarDecisaoAprovacao,
  validarEnfileirarExecucao,
  validarLogin,
  validarProvedorId,
  validarRegistrarEvidencia,
} from "./esquema";

function esperaErro(fn: () => unknown, codigo: string): void {
  try {
    fn();
    throw new Error("esperava um ApiError");
  } catch (erro) {
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).codigo).toBe(codigo);
  }
}

describe("validação de login", () => {
  it("aceita credenciais bem formadas e normaliza o e-mail", () => {
    expect(validarLogin({ email: "Operacao@Exemplo.Invalid", senha: "fire-demo-2026" })).toEqual({
      email: "operacao@exemplo.invalid",
      senha: "fire-demo-2026",
    });
  });

  it("rejeita e-mail inválido e senha curta", () => {
    esperaErro(() => validarLogin({ email: "sem-arroba", senha: "123456" }), "requisicao_invalida");
    esperaErro(() => validarLogin({ email: "a@b.co", senha: "123" }), "requisicao_invalida");
  });

  it("rejeita corpo que não é objeto", () => {
    esperaErro(() => validarLogin(["x"]), "requisicao_invalida");
  });
});

describe("validação de organização / usuário", () => {
  it("aplica ambiente padrão 'demonstracao'", () => {
    expect(validarCriarOrganizacao({ nome: "Org Nova" }).ambiente).toBe("demonstracao");
  });

  it("rejeita papel fora da matriz", () => {
    esperaErro(
      () => validarCriarUsuario({ nome: "Fulano", email: "f@exemplo.invalid", papel: "superadmin" }),
      "requisicao_invalida"
    );
  });
});

describe("validação de missão", () => {
  it("aceita missão completa com prioridade padrão", () => {
    const m = validarCriarMissao({
      codigo: "LAB-100",
      titulo: "Uma missão",
      objetivo: "Executar o objetivo",
      criteriosAceite: ["critério 1"],
    });
    expect(m.prioridade).toBe("media");
    expect(m.criteriosAceite).toEqual(["critério 1"]);
    expect(m.dependencias).toEqual([]);
  });

  it("rejeita quando falta título/objetivo", () => {
    esperaErro(() => validarCriarMissao({ codigo: "X" }), "requisicao_invalida");
  });

  it("bloqueia credencial colada em campo livre (proteção de segredos)", () => {
    esperaErro(
      () => validarCriarMissao({ codigo: "LAB-1", titulo: "Titulo", objetivo: "use token: abcdefgh123456" }),
      "requisicao_invalida"
    );
  });
});

describe("validação de execução", () => {
  it("exige missaoId com formato válido e assume criticidade normal", () => {
    const e = validarEnfileirarExecucao({ missaoId: "msn-1" });
    expect(e.criticidade).toBe("normal");
    expect(e.chaveIdempotencia).toBeNull();
  });

  it("rejeita id com caracteres inválidos", () => {
    esperaErro(() => validarEnfileirarExecucao({ missaoId: "a b/../c" }), "requisicao_invalida");
  });
});

describe("validação de evidência", () => {
  it("o cliente NUNCA consegue declarar 'verificado_independente'", () => {
    const ev = validarRegistrarEvidencia({
      tipo: "commit",
      referencia: "abc123",
      descricao: "commit informado",
      origemDado: "verificado_independente",
    });
    expect(ev.origemDado).toBe("informado_agente");
  });

  it("aceita origem 'informado_operador' quando declarada", () => {
    const ev = validarRegistrarEvidencia({
      tipo: "captura",
      referencia: "tela.png",
      descricao: "captura",
      origemDado: "informado_operador",
    });
    expect(ev.origemDado).toBe("informado_operador");
  });
});

describe("validação de aprovação e provedor", () => {
  it("exige booleano em 'aprovado'", () => {
    esperaErro(() => validarDecisaoAprovacao({ runId: "run-1", aprovado: "sim" }), "requisicao_invalida");
  });

  it("aceita decisão válida", () => {
    expect(validarDecisaoAprovacao({ runId: "run-1", aprovado: true })).toEqual({
      runId: "run-1",
      aprovado: true,
      justificativa: "",
    });
  });

  it("valida o id de provedor", () => {
    expect(validarProvedorId({ id: "github" }).id).toBe("github");
    esperaErro(() => validarProvedorId({ id: "" }), "requisicao_invalida");
  });
});
