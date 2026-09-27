# Fatura VISA SANTANDER 7014: status e valor

## What we found (checked against the real data)
- **The undo worked.** All 114 January lançamentos on the card are "Pendente" now. None of them is paid.
- **The "Paga" label is wrong.** The inner line "Fatura jan/2026" is always shown as "Paga", whatever its lançamentos actually say. That is a display bug.
- **The two totals differ because of the "Saídas" filter.** The fatura has 111 expenses (R$ 20.885,51) and 3 credits or refunds (R$ 149,94). "Saídas" hides the 3 credits, so the list shows R$ 20.885,51. The "Pagar Fatura" window always counts everything: R$ 20.885,51 - R$ 149,94 = **R$ 20.735,57**, which is the real amount to pay.

## Changes
1. **Correct status on the inner fatura line.** It shows "Pendente" or "Paga" from its own lançamentos. When it has pending items, it also gets its own "Pagar Fatura" button, like the main card line.
2. **Warn when a filter changes the fatura total.** If "Entradas" or "Saídas" is on and the fatura has items being hidden, a small note appears next to the total: "Filtro ativo — total real da fatura: R$ 20.735,57". This avoids confusion with the payment window.

No data changes are needed.

## Technical details
- `TransactionTable.tsx` (~line 1104): the child card group passes `pendingCount: 0` as a fixed value. Replace it with the count of `status === "Pendente"` in that group's transactions, and connect `onLiquidate` to the bill payment flow for that card.
- Pass the active type filter down to the table (`Lancamentos.tsx` → `TransactionTable`). When it is not "Tudo", get the full net total for the fatura (the same query the bill payment window uses, by card and due month) and show the note in `CardGroupHeader`.
