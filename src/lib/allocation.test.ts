import { describe, it, expect } from "vitest";
import {
  buildAllocationBudget,
  monthlyFromAllocation,
  percentFromMonthly,
  sumAllocations,
  targetFromMonthly,
  validateAllocation,
  isGoalType,
} from "./allocation";

describe("monthlyFromAllocation", () => {
  it("usa o valor fixo direto", () => {
    expect(monthlyFromAllocation({ mode: "fixed", amount: 1500 }, 2000)).toBe(1500);
  });

  it("aplica percentual sobre a sobra", () => {
    expect(monthlyFromAllocation({ mode: "percent", percent: 30 }, 2000)).toBe(600);
  });

  it("trata sobra negativa como zero", () => {
    expect(monthlyFromAllocation({ mode: "percent", percent: 50 }, -100)).toBe(0);
  });

  it("limita o percentual a 100", () => {
    expect(monthlyFromAllocation({ mode: "percent", percent: 180 }, 1000)).toBe(1000);
  });
});

describe("percentFromMonthly", () => {
  it("converte reais em percentual", () => {
    expect(percentFromMonthly(500, 2000)).toBe(25);
  });
  it("retorna zero sem sobra", () => {
    expect(percentFromMonthly(500, 0)).toBe(0);
  });
});

describe("buildAllocationBudget", () => {
  it("calcula comprometido e livre", () => {
    const b = buildAllocationBudget(2000, [
      { mode: "fixed", amount: 500 },
      { mode: "percent", percent: 25 },
    ]);
    expect(b.committed).toBe(1000);
    expect(b.free).toBe(1000);
    expect(b.committedPercent).toBe(50);
    expect(b.overCommitted).toBe(false);
  });

  it("detecta excesso de alocação", () => {
    const b = buildAllocationBudget(1000, [{ mode: "fixed", amount: 1200 }]);
    expect(b.free).toBe(0);
    expect(b.overCommitted).toBe(true);
  });

  it("zera com sobra negativa", () => {
    const b = buildAllocationBudget(-500, []);
    expect(b.total).toBe(0);
    expect(b.free).toBe(0);
  });
});

describe("validateAllocation", () => {
  const budget = buildAllocationBudget(1000, [{ mode: "fixed", amount: 400 }]);

  it("aceita valor dentro da sobra livre", () => {
    expect(validateAllocation({ mode: "fixed", amount: 600 }, budget).valid).toBe(true);
  });

  it("rejeita valor acima da sobra livre", () => {
    const r = validateAllocation({ mode: "fixed", amount: 900 }, budget);
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it("rejeita zero", () => {
    expect(validateAllocation({ mode: "fixed", amount: 0 }, budget).valid).toBe(false);
  });
});

describe("auxiliares", () => {
  it("sumAllocations soma tudo", () => {
    expect(sumAllocations([{ mode: "fixed", amount: 100 }, { mode: "fixed", amount: 50.5 }], 0)).toBe(150.5);
  });
  it("targetFromMonthly multiplica pelos meses", () => {
    expect(targetFromMonthly(1500, 12)).toBe(18000);
  });
  it("isGoalType valida", () => {
    expect(isGoalType("reserva")).toBe(true);
    expect(isGoalType("carro")).toBe(false);
  });
});
