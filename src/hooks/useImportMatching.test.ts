import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/** Linhas de duas "famílias" de cartão em um mesmo extrato consolidado. */
const rowsInDb = [
  {
    id: "tx-a",
    description: "DROGASIL 4155",
    amount: 19.8,
    payment_date: "2026-03-15",
    competence_date: "2026-02-23",
    purchase_date_original: "2026-02-23",
    type: "despesa",
    status: "Pendente",
    category: null,
    subcategory: null,
    subcategory2: null,
    contact_name: "Drogasil",
    series_id: null,
    installment_number: null,
    installments_total: null,
    credit_card_id: "card-1",
    is_reconciled: false,
  },
  {
    id: "tx-b",
    description: "APPLECOMBILL",
    amount: 51.9,
    payment_date: "2026-03-15",
    competence_date: "2026-02-23",
    purchase_date_original: "2026-02-23",
    type: "despesa",
    status: "Pendente",
    category: null,
    subcategory: null,
    subcategory2: null,
    contact_name: "Apple",
    series_id: null,
    installment_number: null,
    installments_total: null,
    credit_card_id: "card-2",
    is_reconciled: false,
  },
];

function makeQuery(data: any[]) {
  const q: any = {};
  const chain = ["select", "in", "or", "gte", "lte", "eq", "is"];
  chain.forEach((m) => (q[m] = vi.fn(() => q)));
  q.limit = vi.fn(() => Promise.resolve({ data, error: null }));
  q.then = (res: any) => Promise.resolve({ data, error: null }).then(res);
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => makeQuery(rowsInDb)),
  },
}));

import { useImportMatching } from "@/hooks/useImportMatching";

describe("useImportMatching — chaveamento por índice global", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve o match na posição global da linha, não na posição do grupo", async () => {
    const { result } = renderHook(() => useImportMatching());

    // Linha global 7 é do card-2 (Apple). Enviada sozinha, seria a posição 0
    // dentro do grupo — sem rowIndices o resultado voltaria em matches[0].
    let res: any;
    await act(async () => {
      res = await result.current.findMatches(
        [
          {
            date: "2026-02-23",
            description: "APPLECOMBILL",
            amount: 51.9,
            type: "despesa",
          },
        ],
        null,
        null,
        "card-2",
        { cardFamilyIds: ["card-1", "card-2"], rowIndices: [7] },
      );
    });

    expect(res[0]).toBeUndefined();
    expect(res[7]?.best?.candidate.id).toBe("tx-b");
  });
});
