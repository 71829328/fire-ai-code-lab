import { describe, expect, it } from "vitest";
import {
  criarEvidenceRecord,
  resumirEvidencias,
  separarPorOrigem,
  validarEvidenceRecord,
  verificarIndependente,
} from "./center";
import type { EvidenceRecord } from "../platform/types";

const AGORA = "2026-01-01T00:00:00.000Z";

describe("central de evidências — criação e origem", () => {
  it("não preenche verificadoEm quando a origem é informada pelo agente", () => {
    const ev = criarEvidenceRecord({
      organizacaoId: "org-1",
      tipo: "commit",
      referencia: "abc123",
      descricao: "Commit inicial",
      origemDado: "informado_agente",
      agora: AGORA,
    });
    expect(ev.origemDado).toBe("informado_agente");
    expect(ev.verificadoEm).toBeNull();
    expect(ev.verificadoPor).toBeNull();
    expect(ev.timestamp).toBe(AGORA);
  });

  it("preenche verificadoEm/verificadoPor quando verificado independentemente", () => {
    const ev = criarEvidenceRecord({
      organizacaoId: "org-1",
      tipo: "pull_request",
      referencia: "PR-42",
      descricao: "PR revisado",
      origemDado: "verificado_independente",
      verificador: "auditor.silva",
      agora: AGORA,
    });
    expect(ev.origemDado).toBe("verificado_independente");
    expect(ev.verificadoPor).toBe("auditor.silva");
    expect(ev.verificadoEm).toBe(AGORA);
  });
});

describe("central de evidências — verificação independente", () => {
  const base = () =>
    criarEvidenceRecord({
      organizacaoId: "org-1",
      tipo: "teste",
      referencia: "suite",
      descricao: "Todos os testes",
      origemDado: "informado_agente",
      agora: AGORA,
    });

  it("promove a origem e define verificadoEm", () => {
    const original = base();
    const verificada = verificarIndependente(original, "revisor.maria", "2026-02-01T10:00:00.000Z");
    expect(verificada.origemDado).toBe("verificado_independente");
    expect(verificada.verificadoPor).toBe("revisor.maria");
    expect(verificada.verificadoEm).toBe("2026-02-01T10:00:00.000Z");
    // não muta o registro original
    expect(original.origemDado).toBe("informado_agente");
    expect(original.verificadoEm).toBeNull();
  });

  it("lança erro quando o verificador é vazio", () => {
    expect(() => verificarIndependente(base(), "")).toThrow("Verificador obrigatório");
    expect(() => verificarIndependente(base(), "   ")).toThrow("Verificador obrigatório");
  });
});

describe("central de evidências — validação", () => {
  it("rejeita registro sem referencia", () => {
    const r = validarEvidenceRecord({
      id: "ev-1",
      organizacaoId: "org-1",
      tipo: "commit",
      timestamp: AGORA,
    });
    expect(r.valido).toBe(false);
    expect(r.motivos).toContain("referencia ausente");
  });

  it("rejeita tipo inválido", () => {
    const r = validarEvidenceRecord({
      id: "ev-1",
      organizacaoId: "org-1",
      tipo: "inexistente",
      referencia: "x",
      timestamp: AGORA,
    });
    expect(r.valido).toBe(false);
    expect(r.motivos).toContain("tipo inválido");
  });

  it("aceita registro completo e válido", () => {
    const r = validarEvidenceRecord({
      id: "ev-1",
      organizacaoId: "org-1",
      tipo: "teste",
      referencia: "suite",
      timestamp: AGORA,
    });
    expect(r.valido).toBe(true);
    expect(r.motivos).toHaveLength(0);
  });
});

describe("central de evidências — resumo", () => {
  const ev = (overrides: Partial<EvidenceRecord>): EvidenceRecord => ({
    id: "ev-x",
    organizacaoId: "org-1",
    missaoId: null,
    runId: null,
    tipo: "commit",
    referencia: "ref",
    descricao: "",
    valor: "",
    origemDado: "informado_agente",
    registradoPor: null,
    verificadoPor: null,
    verificadoEm: null,
    timestamp: AGORA,
    ...overrides,
  });

  it("separa e resume corretamente por origem e tipo", () => {
    const evs: EvidenceRecord[] = [
      ev({ id: "ev-1", tipo: "commit", origemDado: "informado_agente" }),
      ev({ id: "ev-2", tipo: "teste", origemDado: "informado_operador" }),
      ev({
        id: "ev-3",
        tipo: "relatorio",
        origemDado: "verificado_independente",
        verificadoPor: "auditor",
        verificadoEm: AGORA,
      }),
    ];

    const { informadas, verificadas } = separarPorOrigem(evs);
    expect(informadas).toHaveLength(2);
    expect(verificadas).toHaveLength(1);
    expect(verificadas[0].id).toBe("ev-3");

    const resumo = resumirEvidencias(evs);
    expect(resumo.total).toBe(3);
    expect(resumo.informadas).toBe(2);
    expect(resumo.verificadas).toBe(1);
    expect(resumo.porTipo).toEqual({ commit: 1, teste: 1, relatorio: 1 });
  });
});
