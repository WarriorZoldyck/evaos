import { describe, expect, it, vi } from "vitest";
import { collectUserReminders, formatReminderMessage } from "../../supabase/functions/_shared/whatsappReminders";

describe("whatsappReminders", () => {
  it("groups credit card and child-card pending items into one invoice net of credits", async () => {
    const from = vi.fn((table: string) => {
      const data =
        table === "credit_cards"
          ? [
              { id: "card-main", name: "ITAÚ JOÃO", parent_card_id: null },
              { id: "card-child", name: "ITAÚ ADICIONAL", parent_card_id: "card-main" },
            ]
          : table === "transactions"
            ? [
                { id: "t1", description: "Drogasil", amount: 100, payment_date: "2026-11-21", credit_card_id: "card-main", type: "despesa" },
                { id: "t2", description: "Supermercado", amount: 250.5, payment_date: "2026-11-21", credit_card_id: "card-child", type: "despesa" },
                { id: "t3", description: "Estorno loja", amount: 50.5, payment_date: "2026-11-21", credit_card_id: "card-main", type: "receita" },
                { id: "t4", description: "Boleto Internet", amount: 120, payment_date: "2026-11-21", credit_card_id: null, type: "despesa" },
              ]
            : [];
      const chain: any = { then: (resolve: any) => Promise.resolve({ data, error: null }).then(resolve) };
      for (const m of ["select", "eq", "in", "order"]) chain[m] = () => chain;
      return chain;
    });

    const targetDates = [{ days: 3, dateStr: "2026-11-21" }];
    const collected = await collectUserReminders({ from }, "user-1", targetDates);

    expect(collected.invoices).toEqual([
      {
        cardId: "card-main",
        cardName: "ITAÚ JOÃO",
        payment_date: "2026-11-21",
        totalAmount: 300,
        count: 3,
      },
    ]);
    expect(collected.bills).toEqual([
      { description: "Boleto Internet", amount: 120, payment_date: "2026-11-21" },
    ]);

    const msg = formatReminderMessage("João", collected, targetDates);
    expect(msg).toContain("💳 *Fatura ITAÚ JOÃO* —");
    expect(msg).toContain("300,00 — Vencimento 21/11/2026 (Vence em 3 dias) — 3 lançamentos");
    expect(msg).toContain("💸 *Boleto Internet*");
    expect(msg).toContain("Quer ver os itens de alguma fatura? É só me pedir: *detalhar fatura ITAÚ JOÃO*.");
  });
});
