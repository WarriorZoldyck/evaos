import { describe, it, expect } from "vitest";
import {
  buildCategoryProgress,
  buildCategoryProgressList,
  buildRiskList,
  buildMonthSummary,
  monthElapsedRatio,
} from "./budgetProgress";

// 15/06 => metade do mês (30 dias).
const MID_JUNE = new Date(2026, 5, 15, 12, 0, 0);
const END_JUNE = new Date(2026, 5, 30, 12, 0, 0);

describe("monthElapsedRatio", () => {
  it("meio do mês fica em torno de 0,5", () => {
    expect(monthElapsedRatio(MID_JUNE)).toBeCloseTo(0.5, 2);
  });

  it("último dia fecha em 1", () => {
    expect(monthElapsedRatio(END_JUNE)).toBe(1);
  });

  it("primeiro dia nunca é zero", () => {
    expect(monthElapsedRatio(new Date(2026, 5, 1))).toBeGreaterThan(0);
  });
});

describe("buildCategoryProgress — saídas", () => {
  it("usa a média como alvo automático quando não há meta", () => {
    const p = buildCategoryProgress(
      { name: "ALIMENTAÇÃO", average: 1200, actual: 300 },
      "expense",
      MID_JUNE,
    );
    expect(p.target).toBe(1200);
    expect(p.isAutoTarget).toBe(true);
    expect(p.remaining).toBe(900);
    expect(p.consumedPct).toBe(25);
  });

  it("respeita a meta salva pelo usuário", () => {
    const p = buildCategoryProgress(
      { name: "ALIMENTAÇÃO", average: 1200, actual: 740, target: 900 },
      "expense",
      MID_JUNE,
    );
    expect(p.target).toBe(900);
    expect(p.isAutoTarget).toBe(false);
    expect(p.remaining).toBe(160);
    expect(p.consumedPct).toBeCloseTo(82.22, 1);
    expect(p.status).toBe("near");
  });

  it("marca estouro com o valor exato excedido", () => {
    const p = buildCategoryProgress(
      { name: "UBER", average: 400, actual: 520, target: 400 },
      "expense",
      MID_JUNE,
    );
    expect(p.status).toBe("over");
    expect(p.overBy).toBe(120);
    expect(p.remaining).toBe(0);
    expect(p.message).toContain("Estourou");
  });

  it("alerta ritmo acelerado mesmo abaixo de 80%", () => {
    // metade do mês, 70% do alvo já gasto => pace 1,4
    const p = buildCategoryProgress(
      { name: "MERCADO", average: 1000, actual: 700, target: 1000 },
      "expense",
      MID_JUNE,
    );
    expect(p.paceRatio).toBeCloseTo(1.4, 1);
    expect(p.status).toBe("near");
  });

  it("fica ok quando o consumo acompanha o mês", () => {
    const p = buildCategoryProgress(
      { name: "MERCADO", average: 1000, actual: 500, target: 1000 },
      "expense",
      MID_JUNE,
    );
    expect(p.status).toBe("ok");
    expect(p.paceRatio).toBeCloseTo(1, 1);
  });
});

describe("buildCategoryProgress — entradas", () => {
  it("mostra quanto falta para a meta", () => {
    const p = buildCategoryProgress(
      { name: "CONSULTAS", average: 40000, actual: 30000, target: 55000 },
      "income",
      END_JUNE,
    );
    expect(p.remaining).toBe(25000);
    expect(p.status).toBe("behind");
    expect(p.message).toContain("Faltam");
  });

  it("marca meta alcançada", () => {
    const p = buildCategoryProgress(
      { name: "CONSULTAS", average: 40000, actual: 60000, target: 55000 },
      "income",
      MID_JUNE,
    );
    expect(p.status).toBe("reached");
    expect(p.remaining).toBe(0);
  });

  it("no ritmo quando o recebido acompanha o mês", () => {
    const p = buildCategoryProgress(
      { name: "CONSULTAS", average: 10000, actual: 5000, target: 10000 },
      "income",
      MID_JUNE,
    );
    expect(p.status).toBe("ok");
  });
});

describe("valores de borda", () => {
  it("alvo zero não quebra o cálculo", () => {
    const p = buildCategoryProgress({ name: "X", average: 0, actual: 0, target: 0 }, "expense", MID_JUNE);
    expect(p.consumedPct).toBe(0);
    expect(p.paceRatio).toBe(0);
    expect(p.status).toBe("ok");
  });

  it("valores negativos são tratados como zero", () => {
    const p = buildCategoryProgress({ name: "X", average: -50, actual: -10 }, "expense", MID_JUNE);
    expect(p.average).toBe(0);
    expect(p.actual).toBe(0);
  });
});

describe("buildRiskList", () => {
  const list = buildCategoryProgressList(
    [
      { name: "ALUGUEL", average: 2000, actual: 2000, target: 2000 },
      { name: "MERCADO", average: 1000, actual: 850, target: 1000 },
      { name: "LAZER", average: 500, actual: 100, target: 500 },
      { name: "UBER", average: 300, actual: 500, target: 300 },
    ],
    "expense",
    MID_JUNE,
  );

  it("lista só as categorias em risco, das piores para as melhores", () => {
    const risks = buildRiskList(list);
    expect(risks.map((r) => r.name)).toEqual(["UBER", "ALUGUEL", "MERCADO"]);
    expect(risks[0].status).toBe("over");
  });

  it("ignora entradas", () => {
    const income = buildCategoryProgressList(
      [{ name: "VENDAS", average: 100, actual: 500, target: 100 }],
      "income",
      MID_JUNE,
    );
    expect(buildRiskList(income)).toHaveLength(0);
  });
});

describe("buildMonthSummary", () => {
  it("consolida realizado, alvo e sobra", () => {
    const income = buildCategoryProgressList(
      [{ name: "VENDAS", average: 50000, actual: 30000, target: 55000 }],
      "income",
      MID_JUNE,
    );
    const expense = buildCategoryProgressList(
      [
        { name: "MERCADO", average: 1000, actual: 900, target: 1000 },
        { name: "UBER", average: 300, actual: 500, target: 300 },
      ],
      "expense",
      MID_JUNE,
    );
    const s = buildMonthSummary(income, expense, MID_JUNE);
    expect(s.incomeActual).toBe(30000);
    expect(s.incomeTarget).toBe(55000);
    expect(s.expenseActual).toBe(1400);
    expect(s.expenseTarget).toBe(1300);
    expect(s.realizedLeftover).toBe(28600);
    expect(s.targetLeftover).toBe(53700);
    expect(s.elapsedPct).toBe(50);
    expect(s.risks.map((r) => r.name)).toEqual(["UBER", "MERCADO"]);
  });
});
