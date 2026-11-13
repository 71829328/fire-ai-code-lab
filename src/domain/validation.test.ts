import { describe, expect, it } from "vitest";
import { parseStoredState } from "./validation";

const atividade = { id: "ac-1", tipo: "sistema", acao: "carregou", alvo: "x", timestamp: "2024-01-01T00:00:00.000Z" };

function estadoBase(overrides: Record<string, unknown> = {}) {
  return {
    agentes: [],
    projetos: [],
    tarefas: [],
    atividades: [],
    ...overrides,
  };
}

describe("validation — validação integral dos dados armazenados", () => {
  it("rejeita conteúdo que não é um objeto de estado", () => {
    const r = parseStoredState("nope");
    expect(r.state).toBeNull();
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it("rejeita estado sem as coleções obrigatórias", () => {
    const r = parseStoredState({ agentes: [] });
    expect(r.state).toBeNull();
    expect(r.issues[0].mensagem).toMatch(/obrigatórias/);
  });

  it("aceita um estado válido e normaliza a versão", () => {
    const r = parseStoredState(estadoBase({ atividades: [atividade] }));
    expect(r.state).not.toBeNull();
    expect(r.state!.versao).toBe(2);
  });

  it("migra o formato v1 (flag 'demo') para 'origem'", () => {
    const r = parseStoredState(
      estadoBase({
        agentes: [{ id: "ag-1", nome: "Velho", demo: true }],
        tarefas: [{ id: "tk-1", titulo: "V", demo: false }],
      })
    );
    expect(r.migrado).toBe(true);
    expect(r.state!.agentes[0].origem).toBe("demonstrativo");
    expect(r.state!.tarefas[0].origem).toBe("cadastrado");
  });

  it("força 'desconectado' quando a conexão não foi verificada (nunca online sem comprovação)", () => {
    const r = parseStoredState(
      estadoBase({
        agentes: [
          { id: "ag-1", nome: "A", conexao: "verificado", verificadoEm: "2024-01-01T00:00:00.000Z" },
          { id: "ag-2", nome: "B", conexao: "verificado" }, // sem data de verificação
          { id: "ag-3", nome: "C" }, // sem conexão
        ],
      })
    );
    const [a, b, c] = r.state!.agentes;
    expect(a.conexao).toBe("verificado");
    expect(b.conexao).toBe("desconectado");
    expect(b.verificadoEm).toBeNull();
    expect(c.conexao).toBe("desconectado");
  });

  it("rebaixa integração 'ativa' sem última verificação para 'desativada'", () => {
    const r = parseStoredState(
      estadoBase({
        integracoes: [
          { id: "trae", nome: "TRAE", estado: "ativa", ultimaVerificacao: null },
          { id: "codex", nome: "Codex", estado: "ativa", ultimaVerificacao: "2024-01-01T00:00:00.000Z" },
        ],
      })
    );
    expect(r.state!.integracoes[0].estado).toBe("desativada");
    expect(r.state!.integracoes[1].estado).toBe("ativa");
  });

  it("descarta missão sem identificador único (codigo) e reporta o descarte", () => {
    const r = parseStoredState(
      estadoBase({
        missoes: [
          { id: "ms-1", titulo: "Sem código" },
          { id: "ms-2", codigo: "MSN-0007", titulo: "Com código" },
        ],
      })
    );
    expect(r.state!.missoes).toHaveLength(1);
    expect(r.state!.missoes[0].codigo).toBe("MSN-0007");
    expect(r.descartados).toBeGreaterThanOrEqual(1);
  });

  it("limita valores numéricos fora de faixa (proficiencia/progresso 0-100)", () => {
    const r = parseStoredState(
      estadoBase({
        agentes: [{ id: "ag-1", nome: "A", proficiencia: 250 }],
        projetos: [{ id: "pr-1", nome: "P", progresso: -30 }],
      })
    );
    expect(r.state!.agentes[0].proficiencia).toBe(100);
    expect(r.state!.projetos[0].progresso).toBe(0);
  });

  it("normaliza campos ausentes com valores padrão seguros", () => {
    const r = parseStoredState(estadoBase({ agentes: [{}] }));
    const agente = r.state!.agentes[0];
    expect(agente.nome).toBe("Agente sem nome");
    expect(agente.status).toBe("inativo");
    expect(agente.origem).toBe("cadastrado");
    expect(agente.conexao).toBe("desconectado");
  });

  it("descarta registros que não são objetos e conta os descartes", () => {
    const r = parseStoredState(estadoBase({ agentes: [null, "x", { id: "ok" }] }));
    expect(r.state!.agentes).toHaveLength(1);
    expect(r.descartados).toBe(2);
  });
});
