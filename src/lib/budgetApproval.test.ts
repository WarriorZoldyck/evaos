import { describe, expect, it, vi } from "vitest";
import { buildBudgetInsight, shouldSendBudgetFollowUp } from "../../supabase/functions/_shared/budget-insight";

describe("budget follow-up approval boundary", () => {
  it("never notifies for pending submission", () => {
    expect(shouldSendBudgetFollowUp("pending", "tx-1")).toBe(false);
  });
  it("never notifies for rejection", () => {
    expect(shouldSendBudgetFollowUp("rejected", "tx-1")).toBe(false);
  });
  it("requires the registered transaction identity", () => {
    expect(shouldSendBudgetFollowUp("approved", null)).toBe(false);
    expect(shouldSendBudgetFollowUp("approved", "tx-1")).toBe(true);
  });
  it("calculates the remaining budget from registered transactions only", async () => {
    const from = vi.fn((table: string) => {
      const data = table === "budget_targets" ? [{ category_name: "Alimentação", target_amount: 1000 }]
        : table === "categories" ? [{ id: "cat-1", name: "Alimentação" }]
        : table === "transactions" ? [{ amount: 100 }, { amount: 50 }] : [];
      const chain: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      for (const method of ["select", "eq", "is", "gte", "lte", "or"]) chain[method] = () => chain;
      return chain;
    });
    const message = await buildBudgetInsight({ from }, "owner", null, ["Alimentação"], "despesa");
    expect(message).toContain((850).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    expect(from.mock.calls.map(([table]) => table)).toEqual(["budget_targets", "categories", "transactions"]);
  });
});