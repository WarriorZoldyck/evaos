import { describe, it, expect } from "vitest";
import {
  computeGoalScore,
  buildActionPlan,
  applyResolution,
  monthsBetween,
  addMonths,
  type PlanningGoal,
} from "./goalPlanning";

const NOW = new Date("2026-01-15T12:00:00");

const goal = (over: Partial<PlanningGoal> = {}): PlanningGoal => ({
  id: "g1",
  title: "Reserva",
  targetAmount: 12000,
  currentAmount: 0,
  deadline: "2026-12-15",
  monthlyContribution: 0,
  ...over,
});

describe("monthsBetween / addMonths", () => {
  it("conta meses cheios", () => {
    expect(monthsBetween(NOW, new Date("2026-12-15T00:00:00"))).toBe(11);
    expect(monthsBetween(NOW, new Date("2026-12-14T00:00:00"))).toBe(10);
  });
  it("preserva o fim de mês ao somar", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00"), 1).getMonth()).toBe(1);
    expect(addMonths(new Date("2026-01-31T00:00:00"), 1).getDate()).toBe(28);
  });
});

describe("computeGoalScore", () => {
  it("meta concluída", () => {
    const r = computeGoalScore({
      goal: goal({ currentAmount: 12000 }),
      monthlyCapacity: 1000,
      now: NOW,
    });
    expect(r.status).toBe("CONCLUIDA");
    expect(r.score).toBe(100);
    expect(r.breakdown.remainingAmount).toBe(0);
  });

  it("prazo ausente → dados insuficientes", () => {
    const r = computeGoalScore({
      goal: goal({ deadline: null }),
      monthlyCapacity: 5000,
      now: NOW,
    });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
    expect(r.score).toBe(0);
    expect(r.breakdown.requiredContribution).toBeNull();
  });

  it("alvo zero → dados insuficientes", () => {
    const r = computeGoalScore({
      goal: goal({ targetAmount: 0 }),
      monthlyCapacity: 500,
      now: NOW,
    });
    expect(r.status).toBe("DADOS_INSUFICIENTES");
  });

  it("prazo vencido com valor faltando → não atingível", () => {
    const r = computeGoalScore({
      goal: goal({ deadline: "2026-01-01", currentAmount: 6000 }),
      monthlyCapacity: 1000,
      now: NOW,
    });
    expect(r.breakdown.monthsRemaining).toBe(0);
    expect(r.status).toBe("NAO_ATINGIVEL");
    expect(r.breakdown.requiredContribution).toBe(6000);
  });

  it("capacidade zero e sem aporte planejado → não atingível", () => {
    const r = computeGoalScore({ goal: goal(), monthlyCapacity: 0, now: NOW });
    expect(r.breakdown.coverageRatio).toBe(0);
    expect(r.status).toBe("NAO_ATINGIVEL");
    expect(r.score).toBe(0);
  });

  it("aporte necessário zero (alvo já coberto pelo acumulado)", () => {
    const r = computeGoalScore({
      goal: goal({ currentAmount: 13000 }),
      monthlyCapacity: 0,
      now: NOW,
    });
    expect(r.status).toBe("CONCLUIDA");
    expect(r.breakdown.requiredContribution).toBe(0);
  });

  it("usa a capacidade quando não há aporte planejado", () => {
    const r = computeGoalScore({ goal: goal(), monthlyCapacity: 2000, now: NOW });
    expect(r.breakdown.contributionSource).toBe("CAPACIDADE");
    expect(r.breakdown.effectiveContribution).toBe(2000);
    expect(r.status).toBe("ATINGIVEL");
  });

  it("usa o aporte planejado quando existe, mesmo com capacidade maior", () => {
    const r = computeGoalScore({
      goal: goal({ monthlyContribution: 300 }),
      monthlyCapacity: 5000,
      now: NOW,
    });
    expect(r.breakdown.contributionSource).toBe("PLANEJADO");
    expect(r.breakdown.effectiveContribution).toBe(300);
    expect(r.breakdown.monthlyCapacity).toBe(5000);
    expect(r.status).toBe("EM_RISCO");
  });

  it("faixas de status por cobertura", () => {
    // necessário = 12000 / 11 ≈ 1090.91
    const need = 12000 / 11;
    const st = (ratio: number) =>
      computeGoalScore({
        goal: goal({ monthlyContribution: need * ratio }),
        monthlyCapacity: 0,
        now: NOW,
      }).status;

    expect(st(1.2)).toBe("ATINGIVEL");
    expect(st(0.9)).toBe("ATINGIVEL_COM_AJUSTES");
    expect(st(0.5)).toBe("EM_RISCO");
    expect(st(0.1)).toBe("NAO_ATINGIVEL");
  });

  it("score combina cobertura e progresso de forma determinística", () => {
    const r = computeGoalScore({
      goal: goal({ currentAmount: 6000, monthlyContribution: 6000 / 11 }),
      monthlyCapacity: 0,
      now: NOW,
    });
    // cobertura = 1, progresso = 0.5 → 0.7*100 + 0.3*50 = 85
    expect(r.score).toBe(85);
  });
});

describe("buildActionPlan", () => {
  it("sem breakdown avaliável não gera itens", () => {
    const { breakdown } = computeGoalScore({
      goal: goal({ deadline: null }),
      monthlyCapacity: 100,
      now: NOW,
    });
    expect(buildActionPlan(breakdown, [])).toHaveLength(0);
  });

  it("gera aporte, cortes por categoria e renda extra quando há déficit", () => {
    const { breakdown } = computeGoalScore({
      goal: goal(),
      monthlyCapacity: 100,
      now: NOW,
    });
    const items = buildActionPlan(breakdown, [
      { name: "Alimentação", total: 800 },
      { name: "Transporte", total: 400 },
    ]);
    expect(items[0].kind).toBe("INCREASE_CONTRIBUTION");
    expect(items.some((i) => i.kind === "REDUCE_EXPENSE")).toBe(true);
    expect(items.some((i) => i.kind === "INCREASE_INCOME")).toBe(true);
    expect(items.every((i) => i.source === "SISTEMA")).toBe(true);
  });

  it("sem déficit gera apenas o aporte", () => {
    const { breakdown } = computeGoalScore({
      goal: goal(),
      monthlyCapacity: 10000,
      now: NOW,
    });
    const items = buildActionPlan(breakdown, [{ name: "Alimentação", total: 800 }]);
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("EM_ANDAMENTO");
  });
});

describe("applyResolution", () => {
  const scenario = { goal: goal(), monthlyCapacity: 500 };

  it("EXTEND_DEADLINE empurra o prazo", () => {
    const r = applyResolution(scenario, { kind: "EXTEND_DEADLINE", months: 6 }, NOW);
    expect(r.goal.deadline).toBe("2027-06-15");
  });

  it("REDUCE_TARGET nunca fica abaixo do acumulado", () => {
    const r = applyResolution(
      { goal: goal({ currentAmount: 5000 }), monthlyCapacity: 0 },
      { kind: "REDUCE_TARGET", amount: 99999 },
      NOW,
    );
    expect(r.goal.targetAmount).toBe(5000);
  });

  it("INCREASE_CONTRIBUTION soma ao aporte", () => {
    const r = applyResolution(scenario, { kind: "INCREASE_CONTRIBUTION", amount: 250 }, NOW);
    expect(r.goal.monthlyContribution).toBe(250);
  });

  it("REDUCE_EXPENSE e INCREASE_INCOME aumentam a capacidade", () => {
    expect(
      applyResolution(scenario, { kind: "REDUCE_EXPENSE", amount: 200 }, NOW).monthlyCapacity,
    ).toBe(700);
    expect(
      applyResolution(scenario, { kind: "INCREASE_INCOME", amount: 300 }, NOW).monthlyCapacity,
    ).toBe(800);
  });

  it("não muta o cenário original", () => {
    applyResolution(scenario, { kind: "INCREASE_CONTRIBUTION", amount: 100 }, NOW);
    expect(scenario.goal.monthlyContribution).toBe(0);
  });
});
