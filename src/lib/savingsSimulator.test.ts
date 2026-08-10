import { describe, it, expect } from "vitest";
import {
  monthlyAverage,
  clampPercent,
  simulateSavings,
  deadlineFromMonths,
} from "./savingsSimulator";

describe("savingsSimulator", () => {
  it("calcula média mensal", () => {
    expect(monthlyAverage(1200)).toBe(100);
    expect(monthlyAverage(-50)).toBe(0);
  });

  it("limita percentuais", () => {
    expect(clampPercent(-10)).toBe(0);
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(NaN)).toBe(0);
  });

  it("soma economia dos cortes", () => {
    const r = simulateSavings({
      targetAmount: 1200,
      months: 12,
      categories: [{ name: "Alimentação", total: 2400 }],
      cuts: [{ name: "Alimentação", percent: 50 }],
    });
    expect(r.requiredMonthly).toBe(100);
    expect(r.simulatedMonthly).toBe(100);
    expect(r.feasible).toBe(true);
    expect(r.projectedTotal).toBe(1200);
  });

  it("marca inviável quando corte não cobre", () => {
    const r = simulateSavings({
      targetAmount: 12000,
      months: 12,
      categories: [{ name: "Lazer", total: 1200 }],
      cuts: [{ name: "Lazer", percent: 100 }],
    });
    expect(r.missingMonthly).toBeCloseTo(900);
    expect(r.feasible).toBe(false);
  });

  it("gera prazo ISO", () => {
    expect(deadlineFromMonths(12, new Date(2026, 0, 15))).toBe("2027-01-15");
  });
});
