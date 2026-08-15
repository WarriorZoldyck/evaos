import { describe, it, expect } from "vitest";
import { buildGoalInsight, monthsUntil } from "./goalInsight";

const NOW = new Date(2026, 0, 15); // 15/01/2026

describe("monthsUntil", () => {
  it("conta meses inteiros até o prazo", () => {
    expect(monthsUntil("2026-07-01", NOW)).toBe(6);
  });
  it("nunca retorna negativo", () => {
    expect(monthsUntil("2025-01-01", NOW)).toBe(0);
  });
});

describe("buildGoalInsight", () => {
  it("marca meta concluída", () => {
    const i = buildGoalInsight(
      { id: "1", name: "Viagem", target: 1000, current: 1000, deadline: "2026-12-01" },
      500,
      NOW,
    );
    expect(i.status).toBe("done");
    expect(i.remaining).toBe(0);
    expect(i.progressPct).toBe(100);
  });

  it("trata meta sem prazo usando o ritmo atual", () => {
    const i = buildGoalInsight(
      { id: "2", name: "Reserva", target: 1200, current: 200, deadline: null },
      250,
      NOW,
    );
    expect(i.status).toBe("no_deadline");
    expect(i.monthsLeft).toBeNull();
    expect(i.monthsAtCurrentPace).toBe(4);
  });

  it("detecta meta dentro do ritmo", () => {
    const i = buildGoalInsight(
      { id: "3", name: "Notebook", target: 6000, current: 0, deadline: "2026-07-01" },
      1500,
      NOW,
    );
    expect(i.requiredMonthly).toBe(1000);
    expect(i.gap).toBe(500);
    expect(i.status).toBe("on_track");
  });

  it("detecta atraso leve dentro de 20% do necessário", () => {
    const i = buildGoalInsight(
      { id: "4", name: "Curso", target: 6000, current: 0, deadline: "2026-07-01" },
      900,
      NOW,
    );
    expect(i.status).toBe("slightly_behind");
    expect(i.gap).toBe(-100);
  });

  it("detecta meta fora do ritmo", () => {
    const i = buildGoalInsight(
      { id: "5", name: "Carro", target: 60000, current: 0, deadline: "2026-07-01" },
      1000,
      NOW,
    );
    expect(i.status).toBe("off_track");
    expect(i.monthsAtCurrentPace).toBe(60);
  });

  it("lida com capacidade zero sem quebrar", () => {
    const i = buildGoalInsight(
      { id: "6", name: "Casa", target: 1000, current: 0, deadline: null },
      0,
      NOW,
    );
    expect(i.monthsAtCurrentPace).toBeNull();
    expect(i.status).toBe("no_deadline");
  });
});
