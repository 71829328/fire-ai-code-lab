import { describe, expect, it } from "vitest";
import { buildMissionPrompt } from "./missionPrompt";
import { createSeedState } from "../data/seed";

const missao = createSeedState().missoes.find((m) => m.id === "ms-002")!;

describe("missionPrompt — prompt completo da missão", () => {
  it("inclui identificador único e título", () => {
    const prompt = buildMissionPrompt(missao);
    expect(prompt).toContain("MISSÃO MSN-0002");
    expect(prompt).toContain(missao.titulo);
  });

  it("inclui objetivo, instruções e critérios de aceite como checklist", () => {
    const prompt = buildMissionPrompt(missao);
    expect(prompt).toContain("## Objetivo");
    expect(prompt).toContain("## Instruções");
    expect(prompt).toContain("## Critérios de aceite");
    expect(prompt).toContain("- [ ]");
  });

  it("lista dependências quando fornecidas no contexto", () => {
    const prompt = buildMissionPrompt(missao, {
      dependencias: [{ codigo: "MSN-0001", titulo: "Base", status: "concluida" }],
    });
    expect(prompt).toContain("## Dependências");
    expect(prompt).toContain("MSN-0001");
  });

  it("lista as evidências já registradas", () => {
    const prompt = buildMissionPrompt(missao);
    expect(prompt).toContain("## Evidências registradas");
  });

  it("deixa explícito que a execução é manual e sem integração automática", () => {
    const prompt = buildMissionPrompt(missao);
    expect(prompt).toMatch(/Execução manual\/assistida/);
    expect(prompt).toMatch(/Nenhuma integração automática está ativa/);
  });

  it("trata missão sem critérios nem objetivo informados", () => {
    const vazia = { ...missao, criteriosAceite: [], objetivo: "", instrucoes: "" };
    const prompt = buildMissionPrompt(vazia);
    expect(prompt).toContain("(não informado)");
    expect(prompt).toContain("- (nenhum critério informado)");
  });
});
