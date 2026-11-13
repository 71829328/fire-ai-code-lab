import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import {
  moverParaColuna,
  normalizarColuna,
  proximaOrdem,
  statusAnterior,
  statusProximo,
  tarefasDaColuna,
} from "./ordering";

// Tarefas de teste: duas colunas com ordens propositalmente "furadas".
const t = (id: string, status: Task["status"], ordem: number, criadoEm = "2024-01-01T00:00:00.000Z"): Task => ({
  id,
  titulo: id,
  descricao: "",
  status,
  prioridade: "media",
  projetoId: null,
  agenteId: null,
  ordem,
  criadoEm,
  origem: "demonstrativo",
});

const base: Task[] = [
  t("a", "pendente", 0),
  t("b", "pendente", 1),
  t("c", "pendente", 2),
  t("d", "em_execucao", 0),
];

describe("ordering — ordenação do Kanban (correção da auditoria)", () => {
  it("tarefasDaColuna filtra por status e ordena por 'ordem'", () => {
    const coluna = tarefasDaColuna(base, "pendente");
    expect(coluna.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("proximaOrdem considera TODAS as tarefas da coluna, não apenas as filtradas", () => {
    // Simula o bug: a UI filtra (por busca) para 1 item, mas a ordem deve usar o conjunto completo.
    const filtradas = base.filter((x) => x.id === "a"); // subconjunto visível (ordem 0)
    expect(proximaOrdem(filtradas, "pendente")).toBe(1); // comportamento ingênuo (com o bug)
    expect(proximaOrdem(base, "pendente")).toBe(3); // correto: 3 = max(0,1,2)+1
  });

  it("proximaOrdem devolve 0 para coluna vazia", () => {
    expect(proximaOrdem(base, "concluida")).toBe(0);
  });

  it("normalizarColuna reindexa (0,1,2...) sem deixar buracos nem colisões", () => {
    const comBuracos = [t("x", "pendente", 5), t("y", "pendente", 9), t("z", "pendente", 7)];
    const normalizadas = normalizarColuna(comBuracos, "pendente");
    const ordens = normalizadas
      .filter((x) => x.status === "pendente")
      .sort((p, q) => p.ordem - q.ordem)
      .map((x) => x.ordem);
    expect(ordens).toEqual([0, 1, 2]);
    // Nenhuma colisão: cada ordem é única.
    expect(new Set(ordens).size).toBe(ordens.length);
  });

  it("moverParaColuna move a tarefa para o fim da coluna de destino", () => {
    const movidas = moverParaColuna(base, "a", "em_execucao");
    const destino = tarefasDaColuna(movidas, "em_execucao");
    expect(destino.map((x) => x.id)).toEqual(["d", "a"]);
    // A coluna de origem foi reindexada sem buracos.
    const origem = tarefasDaColuna(movidas, "pendente");
    expect(origem.map((x) => x.ordem)).toEqual([0, 1]);
  });

  it("moverParaColuna é inócuo quando a tarefa já está na coluna de destino", () => {
    expect(moverParaColuna(base, "a", "pendente")).toBe(base);
    expect(moverParaColuna(base, "inexistente", "pendente")).toBe(base);
  });

  it("statusAnterior/statusProximo respeitam os limites do quadro", () => {
    expect(statusAnterior("pendente")).toBeNull();
    expect(statusProximo("concluida")).toBeNull();
    expect(statusProximo("pendente")).toBe("em_execucao");
    expect(statusAnterior("concluida")).toBe("em_execucao");
  });
});
