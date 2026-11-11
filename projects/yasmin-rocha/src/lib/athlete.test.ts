import { describe, expect, it } from "vitest";
import { BASELINE, ACHIEVEMENTS, IDEAS, PILLARS, IG_URL, SNAPSHOT_DATE } from "./athlete";

describe("dados públicos auditáveis", () => {
  it("preserva a captura manual sem prometer atualização em tempo real", () => {
    expect(SNAPSHOT_DATE).toBe("2026-11-11");
    expect(BASELINE).toMatchObject({ followers: 6090, posts: 200, following: 1428 });
    expect(IG_URL).toBe("https://www.instagram.com/yasmin_karate_/");
  });

  it("mantém os resultados explicitamente associados a 2025 quando necessário", () => {
    const ranking = ACHIEVEMENTS.find((a) => a.title === "Ranking CBK");
    expect(ranking?.detail).toContain("2025");
    expect(ranking?.note).toContain("2025");
    expect(ACHIEVEMENTS).toHaveLength(6);
  });

  it("tem uma grade editorial real com cinco pilares e dez roteiros", () => {
    expect(PILLARS).toHaveLength(5);
    expect(IDEAS).toHaveLength(10);
    const ids = new Set(PILLARS.map((p) => p.id));
    for (const idea of IDEAS) {
      expect(ids.has(idea.pillar)).toBe(true);
      expect(idea.hook.length).toBeGreaterThan(5);
      expect(idea.cta.length).toBeGreaterThan(5);
    }
  });
});
