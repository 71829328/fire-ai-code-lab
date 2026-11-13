import { describe, expect, it } from "vitest";
import { criarRegistro, listarAdaptadores, obterAdaptador } from "./registry";
import { exportarMissao, importarResultado } from "./manualFlow";
import { INTEGRACOES_PENDENTES, INTEGRACOES_REAIS_DISPONIVEIS } from "./capabilities";
import { createSeedState } from "../data/seed";
import type { MissionView } from "../orchestration/types";

const IDS_EXTERNOS = ["chatgpt", "codex", "work", "trae", "manus", "fire_private_ai"];

const missaoView: MissionView = {
  id: "ms-teste",
  codigo: "MSN-9999",
  titulo: "Missão de teste",
  prioridade: "media",
  status: "pendente",
  dependencias: [],
  agenteId: null,
  instrucoes: "Executar conforme os critérios.",
  criteriosAceite: [],
};

describe("adapters — honestidade de disponibilidade", () => {
  it("nenhum adaptador se declara 'disponivel' sem autorização", () => {
    const registro = criarRegistro();
    for (const adaptador of Object.values(registro)) {
      expect(adaptador.validarDisponibilidade().status).not.toBe("disponivel");
    }
  });

  it("envio em adaptador não autorizado é recusado e cai no fluxo manual", () => {
    const registro = criarRegistro();
    for (const id of IDS_EXTERNOS) {
      const envio = registro[id].enviarMissao({ missao: missaoView, prompt: "prompt de teste" });
      expect(envio.aceito).toBe(false);
      expect(envio.modo).toBe("manual_assistido");
      expect(envio.referencia).toBeNull();
    }
  });

  it("consultarExecucao e receberResultado refletem a ausência de integração", () => {
    const adaptador = criarRegistro()["chatgpt"];
    expect(adaptador.consultarExecucao("ref-1").estado).toBe("desconhecido");
    expect(adaptador.receberResultado("ref-1")).toBeNull();
  });
});

describe("adapters — registro", () => {
  it("listarAdaptadores contém os sete ids esperados", () => {
    const ids = listarAdaptadores()
      .map((adaptador) => adaptador.descriptor.id)
      .sort();
    expect(ids).toEqual([...IDS_EXTERNOS, "custom"].sort());
  });

  it("obterAdaptador retorna null para id inexistente", () => {
    expect(obterAdaptador("inexistente")).toBeNull();
    expect(obterAdaptador("custom")).not.toBeNull();
  });
});

describe("manualFlow — exportação e importação", () => {
  it("exportarMissao gera prompt e nome de arquivo com o código da missão", () => {
    const missao = createSeedState().missoes[0];
    const { prompt, nomeArquivo } = exportarMissao(missao);
    expect(prompt).toContain(missao.codigo);
    expect(nomeArquivo).toContain(missao.codigo);
    expect(nomeArquivo).toMatch(/^missao-.*\.md$/);
  });

  it("importarResultado lança em texto vazio", () => {
    expect(() => importarResultado("")).toThrow("Relatório vazio");
    expect(() => importarResultado("   \n  ")).toThrow("Relatório vazio");
  });

  it("importarResultado extrai resumo e artefatos de um relatório real", () => {
    const texto = [
      "Conclusão da missão de exemplo",
      "commit: abc1234",
      "PR: https://example.com/pr/1",
      "testes: 67 aprovados",
    ].join("\n");

    const resultado = importarResultado(texto);
    expect(resultado.resumo).toBe("Conclusão da missão de exemplo");
    expect(resultado.bruto).toBe(texto);
    expect(resultado.artefatos.length).toBeGreaterThanOrEqual(1);

    const nomes = resultado.artefatos.map((artefato) => artefato.nome);
    expect(nomes).toContain("commit");
    expect(nomes).toContain("PR");
  });
});

describe("capabilities — catálogo honesto", () => {
  it("nenhum provedor externo consta como realmente disponível", () => {
    for (const id of IDS_EXTERNOS) {
      expect(INTEGRACOES_REAIS_DISPONIVEIS).not.toContain(id);
    }
  });

  it("provedores externos permanecem pendentes", () => {
    expect(INTEGRACOES_PENDENTES).toEqual(
      expect.arrayContaining(["chatgpt", "codex", "work", "trae", "manus"])
    );
  });
});
