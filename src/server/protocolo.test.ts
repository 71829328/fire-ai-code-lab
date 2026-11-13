import { describe, expect, it } from "vitest";
import {
  AGENTES_CONHECIDOS,
  GatewayAgentes,
  montarEnvelope,
  PROTOCOLO_VERSAO,
  validarEnvelope,
  type TransporteAgente,
} from "./protocolo";
import type { MissaoServidor } from "./store";

const missao: MissaoServidor = {
  id: "msn-1",
  organizacaoId: "org-demo",
  codigo: "LAB-1",
  titulo: "Título",
  prioridade: "alta",
  status: "pendente",
  dependencias: ["msn-0"],
  agenteId: "codex",
  instrucoes: "fazer",
  criteriosAceite: ["passa nos testes"],
  objetivo: "Objetivo da missão",
  criadoEm: "2026-01-01T00:00:00.000Z",
};

describe("envelope do protocolo fire-agent/1", () => {
  it("monta o envelope a partir da missão persistida", () => {
    const env = montarEnvelope({ missao, contexto: "ctx" });
    expect(env.protocolo).toBe(PROTOCOLO_VERSAO);
    expect(env.missaoId).toBe("msn-1");
    expect(env.objetivo).toBe("Objetivo da missão");
    expect(env.contexto).toBe("ctx");
    expect(env.criteriosAceite).toEqual(["passa nos testes"]);
    expect(env.dependencias).toEqual(["msn-0"]);
    expect(env.agenteResponsavel).toBe("codex");
    expect(env.estado).toBe("enfileirada");
    expect(validarEnvelope(env).valido).toBe(true);
  });

  it("rejeita envelope sem protocolo ou campos obrigatórios", () => {
    const env = montarEnvelope({ missao });
    expect(validarEnvelope({ ...env, protocolo: "outro/2" }).valido).toBe(false);
    expect(validarEnvelope({ ...env, objetivo: "" }).valido).toBe(false);
    expect(validarEnvelope({ ...env, estado: "inventado" }).valido).toBe(false);
    expect(validarEnvelope({ ...env, evidencias: "nao-e-lista" }).valido).toBe(false);
    expect(validarEnvelope(null).valido).toBe(false);
  });
});

describe("gateway de agentes (honesto)", () => {
  it("sem transporte registrado, tudo cai em fluxo manual assistido", async () => {
    const gateway = new GatewayAgentes();
    const env = montarEnvelope({ missao });
    const resultado = await gateway.enviar("chatgpt", env);
    expect(resultado.enviado).toBe(false);
    expect(resultado.modo).toBe("manual_assistido");

    const lista = gateway.listar(AGENTES_CONHECIDOS);
    expect(lista).toHaveLength(AGENTES_CONHECIDOS.length);
    expect(lista.every((a) => a.status === "nao_autorizado" && !a.temTransporte)).toBe(true);
  });

  it("usa o transporte apenas quando registrado E disponível", async () => {
    const gateway = new GatewayAgentes();
    const enviados: string[] = [];
    const transporte: TransporteAgente = {
      agenteId: "codex",
      disponibilidade: () => ({ status: "disponivel", motivo: "credencial válida" }),
      enviar: async (envelope) => {
        enviados.push(envelope.missaoId);
        return { enviado: true, modo: "automatico", referencia: "ref-1", mensagem: "ok" };
      },
    };
    gateway.registrar(transporte);
    const resultado = await gateway.enviar("codex", montarEnvelope({ missao }));
    expect(resultado.enviado).toBe(true);
    expect(resultado.modo).toBe("automatico");
    expect(enviados).toEqual(["msn-1"]);
  });

  it("transporte indisponível não envia nada", async () => {
    const gateway = new GatewayAgentes();
    gateway.registrar({
      agenteId: "manus",
      disponibilidade: () => ({ status: "indisponivel", motivo: "sem autorização" }),
      enviar: async () => ({ enviado: true, modo: "automatico", referencia: "x", mensagem: "não deveria" }),
    });
    const resultado = await gateway.enviar("manus", montarEnvelope({ missao }));
    expect(resultado.enviado).toBe(false);
    expect(resultado.modo).toBe("manual_assistido");
  });

  it("envelope inválido nunca é enviado", async () => {
    const gateway = new GatewayAgentes();
    const resultado = await gateway.enviar("codex", { protocolo: "x" } as never);
    expect(resultado.enviado).toBe(false);
  });
});
