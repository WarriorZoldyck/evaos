import { describe, expect, it, vi } from "vitest";
import { buildBudgetInsight, buildPendingBudgetPreview, shouldSendBudgetFollowUp } from "../../supabase/functions/_shared/budget-insight";

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
  it("sums registered transactions and pending analysis entries", async () => {
    const from = vi.fn((table: string) => {
      const data = table === "budget_targets" ? [{ category_name: "Alimentação", target_amount: 1000 }]
        : table === "categories" ? [{ id: "cat-1", name: "Alimentação" }]
        : table === "transactions" ? [{ amount: 100 }, { amount: 50 }]
        : table === "ai_pending_transactions" ? [{ amount: 200 }] : [];
      const chain: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      for (const method of ["select", "eq", "is", "in", "gte", "lte", "or"]) chain[method] = () => chain;
      return chain;
    });
    const message = await buildBudgetInsight({ from }, "owner", null, ["Alimentação"], "despesa");
    expect(message).toContain((650).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    expect(message).toContain("pendentes de análise");
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "budget_targets",
      "categories",
      "transactions",
      "ai_pending_transactions",
    ]);
  });

  it("previews pending WhatsApp launch against parent category budget summing pending entries", async () => {
    const from = vi.fn((table: string) => {
      const data = table === "budget_targets" ? [{ category_name: "Alimentação", target_amount: 1000 }]
        : table === "categories" ? [
            { id: "11111111-1111-1111-1111-111111111111", name: "Alimentação", parent_id: null },
            { id: "22222222-2222-2222-2222-222222222222", name: "Restaurante", parent_id: "11111111-1111-1111-1111-111111111111" },
          ]
        : table === "transactions" ? [{ amount: 700 }]
        : table === "ai_pending_transactions" ? [{ amount: 450 }] : [];
      const chain: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      for (const method of ["select", "eq", "is", "in", "gte", "lte", "or"]) chain[method] = () => chain;
      return chain;
    });
    const overMsg = await buildPendingBudgetPreview(
      { from }, "owner", null, ["22222222-2222-2222-2222-222222222222"], "despesa", 0,
    );
    expect(overMsg).toContain("Atenção à meta de Alimentação:");
    expect(overMsg).toContain("acima da meta");
    expect(overMsg).toContain("pendentes de análise");
  });

  it("shows within-budget confirmation when pending launch fits", async () => {
    const from = vi.fn((table: string) => {
      const data = table === "budget_targets" ? [{ category_name: "Alimentação", target_amount: 1000 }]
        : table === "categories" ? [{ id: "11111111-1111-1111-1111-111111111111", name: "Alimentação", parent_id: null }]
        : table === "transactions" ? [{ amount: 200 }] : [];
      const chain: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      for (const method of ["select", "eq", "is", "in", "gte", "lte", "or"]) chain[method] = () => chain;
      return chain;
    });
    const okMsg = await buildPendingBudgetPreview(
      { from }, "owner", null, ["Alimentação"], "despesa", 150,
    );
    expect(okMsg).toContain("dentro da meta!");
  });
});
