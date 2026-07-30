import { describe, it, expect } from "vitest";
import {
  sumAmounts,
  sumCandidates,
  validateGroupBalance,
  isBatchGroup,
  groupRowIndexes,
  collectGroupedRows,
  collectGroupedSystemIds,
  buildGroupPlan,
  buildAllGroupPlans,
} from "./grouping";

describe("sumAmounts", () => {
  it("soma valores absolutos com 2 casas", () => {
    expect(sumAmounts([10.1, 20.2, -5.05])).toBe(35.35);
  });
  it("ignora lixo", () => {
    expect(sumAmounts([NaN as unknown as number, 3])).toBe(3);
  });
});

describe("validateGroupBalance", () => {
  const rows = [{ index: 0, amount: 3400 }];

  it("Caso A: 1 linha ↔ 3 lançamentos que somam o mesmo valor", () => {
    const r = validateGroupBalance(rows, [
      { id: "a", amount: 1000 },
      { id: "b", amount: 1400 },
      { id: "c", amount: 1000 },
    ]);
    expect(r.systemTotal).toBe(3400);
    expect(r.delta).toBe(0);
    expect(r.valid).toBe(true);
  });

  it("Caso B: 2 linhas ↔ 1 lançamento", () => {
    const r = validateGroupBalance(
      [
        { index: 0, amount: 700 },
        { index: 4, amount: 500 },
      ],
      [{ id: "x", amount: 1200 }],
    );
    expect(r.statementTotal).toBe(1200);
    expect(r.valid).toBe(true);
  });

  it("aceita diferença de centavos dentro da tolerância", () => {
    const r = validateGroupBalance(rows, [{ id: "a", amount: 3399.98 }]);
    expect(r.balanced).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("recusa quando não bate", () => {
    const r = validateGroupBalance(rows, [{ id: "a", amount: 3000 }]);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("unbalanced");
    expect(r.delta).toBe(400);
  });

  it("recusa grupo sem lançamento do sistema", () => {
    expect(validateGroupBalance(rows, []).reason).toBe("no-system");
  });

  it("recusa grupo sem linha do extrato", () => {
    expect(validateGroupBalance([], [{ id: "a", amount: 1 }]).reason).toBe("no-statement");
  });
});

describe("helpers de grupo", () => {
  it("isBatchGroup exige mais de um participante", () => {
    expect(isBatchGroup({ systemIds: ["a"], extraRowIdx: [] })).toBe(false);
    expect(isBatchGroup({ systemIds: ["a", "b"], extraRowIdx: [] })).toBe(true);
    expect(isBatchGroup({ systemIds: ["a"], extraRowIdx: [3] })).toBe(true);
  });

  it("groupRowIndexes inclui a líder primeiro", () => {
    expect(groupRowIndexes(2, { systemIds: [], extraRowIdx: [5, 7] })).toEqual([2, 5, 7]);
  });

  it("collectGroupedRows e collectGroupedSystemIds", () => {
    const groups = {
      0: { systemIds: ["a", "b"], extraRowIdx: [] },
      3: { systemIds: ["c"], extraRowIdx: [4] },
    };
    expect([...collectGroupedRows(groups)].sort()).toEqual([0, 3, 4]);
    expect([...collectGroupedSystemIds(groups)].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("buildGroupPlan", () => {
  const rows = [
    { date: "2026-01-05", amount: 3400 },
    { date: "2026-01-06", amount: 100 },
    { date: "2026-01-09", amount: 500 },
  ];

  it("Caso A grava fingerprint apenas no primeiro lançamento", () => {
    const plan = buildGroupPlan({
      leaderIdx: 0,
      state: { systemIds: ["a", "b"], extraRowIdx: [] },
      rows,
      systemById: new Map(),
      fingerprints: { 0: "fp-0" },
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toMatchObject({ id: "a", payment_date: "2026-01-05", is_reconciled: true, import_fingerprint: "fp-0" });
    expect(plan[1].import_fingerprint).toBeUndefined();
    expect(plan[1].payment_date).toBe("2026-01-05");
  });

  it("Caso B: 2 linhas, 1 lançamento → usa data da líder", () => {
    const plan = buildGroupPlan({
      leaderIdx: 0,
      state: { systemIds: ["x"], extraRowIdx: [2] },
      rows,
      systemById: new Map(),
      fingerprints: { 0: "fp-0", 2: "fp-2" },
    });
    expect(plan).toEqual([
      { id: "x", payment_date: "2026-01-05", is_reconciled: true, import_fingerprint: "fp-0" },
    ]);
  });

  it("devolve vazio quando a líder não existe", () => {
    expect(
      buildGroupPlan({
        leaderIdx: 99,
        state: { systemIds: ["a"], extraRowIdx: [] },
        rows,
        systemById: new Map(),
      }),
    ).toEqual([]);
  });

  it("buildAllGroupPlans concatena", () => {
    const plans = buildAllGroupPlans(
      { 0: { systemIds: ["a"], extraRowIdx: [] }, 1: { systemIds: ["b"], extraRowIdx: [] } },
      rows,
      new Map(),
    );
    expect(plans.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
