import { describe, it, expect } from "vitest";
import {
  simulateSavings,
  monthlyAverage,
  clampPercent,
  deadlineFromMonths,
} from "./savingsSimulator";

describe("savingsSimulator", () => {
  it("calcula média mensal a partir do total do ano", () => {
    expect(monthlyAverage(1200)).toBe(100);
    expect(monthlyAverage(1200, 6)).toBe(200);
    expect(monthlyAverage(-50)).toBe(0);
  });

  it("limita percentuais entre 0 e 100", () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(NaN)).toBe(0);
  });

  it("calcula aporte necessário e economia simulada", () => {
    const r = simulateSavings({
      targetAmount: 12000,
      months: 12,
      categories: [{ name: "Alimentação", total: 12000 }],
      cuts: [{ name: "Alimentação", percent: 50 }],
    });
    expect(r.requiredMonthly).toBe(1000);
    expect(r.simulatedMonthly).toBe(500);
    expect(r.missingMonthly).toBe(500);
    expect(r.coverage).toBeCloseTo(0.5);
    expect(r.feasible).toBe(false);
    expect(r.projectedTotal).toBe(6000);
  });

  it("marca como viável quando a economia cobre o aporte", () => {
    const r = simulateSavings({
      targetAmount: 6000,
      months: 12,
      categories: [
        { name: "A", total: 6000 },
        { name: "B", total: 6000 },
      ],
      cuts: [
        { name: "A", percent: 100 },
        { name: "B", percent: 0 },
      ],
    });
    expect(r.simulatedMonthly).toBe(500);
    expect(r.feasible).toBe(true);
  });

  it("ignora meses inválidos usando no mínimo 1", () => {
    const r = simulateSavings({ targetAmount: 1000, months: 0, categories: [], cuts: [] });
    expect(r.requiredMonthly).toBe(1000);
  });

  it("gera deadline ISO somando meses", () => {
    expect(deadlineFromMonths(6, new Date(2026, 0, 15))).toBe("2026-07-15");
  });
});
