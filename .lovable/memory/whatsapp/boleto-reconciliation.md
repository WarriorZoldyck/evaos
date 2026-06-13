---
name: WhatsApp Boleto Reconciliation
description: When user pays a boleto via WhatsApp, EVA scans existing Pendente transactions and, if a match is found, attaches a [SUGESTAO_BAIXA] block to the new ai_pending_transactions row so the user can confirm and give baixa from Análises EVA (no UPDATE direct from webhook, no Sim/Não via WhatsApp).
type: feature
---

When the user sends a payment proof for a despesa via WhatsApp (status=Pago, no credit card, no parcelas), the webhook runs `findMatchingPendingBoleto`:

- Search window: `transactions` rows with `status='Pendente'`, `type='despesa'`, same `user_id` and `company_id` context, `payment_date` between today−180d and today+30d (limit 50).
- Scoring (0–3): supplier (id equal OR Jaccard ≥ 0.5 OR substring on contact_name), amount (≤ R$0,02 or 0.5% diff), description/notes (Jaccard ≥ 0.4).
- Hard filter: candidate amount must be within max(R$2, 10%) of the new amount.
- Helpers are named `normalizeBoletoText`, `tokenSet`, `jaccardSimilarity`, `amountMatches` (do NOT rename to `normalizeText` — it collides with another function in the same file).

If best score ≥ 2:
- The new transaction is still inserted into `ai_pending_transactions` (normal flow), **plus** a structured block is appended to `notes`:
  ```
  [SUGESTAO_BAIXA]
  transaction_id: <uuid>
  descricao: ...
  valor: 123.45
  vencimento: YYYY-MM-DD
  fornecedor: ...
  score: 2
  ```
- The WhatsApp reply prepends a short notice telling the user EVA found a similar pendente and to confirm in Análises EVA.

Análises EVA UI (`src/pages/AnalisesEva.tsx` → `PendingCard`):
- `parseBoletoSuggestion(notes)` extracts the block.
- Shows a "Possível baixa de pendente" badge and a yellow card with the suggestion details.
- Button **"Dar baixa no pendente (não criar novo)"** calls `handleReconcile`, which:
  1. `UPDATE transactions SET status='Pago', payment_date/bank_account_id/wallet_id/payment_method/attachment_url=<from pending>` on `transaction_id`.
  2. `UPDATE ai_pending_transactions SET status='approved', reviewed_at=now()` on the pending row.

There is **no** `confirm_boleto_match` action_type in `whatsapp_pending_actions` and the webhook never UPDATEs `transactions` directly. The user always confirms in the app.
