---
name: WhatsApp Boleto Reconciliation
description: When user pays a boleto via WhatsApp, EVA matches against existing Pendente transactions (supplier/value/description, 2/3 score) and asks for confirmation before giving baixa instead of duplicating in Análises EVA.
type: feature
---

When the user sends a payment proof for a despesa via WhatsApp (status=Pago, no credit card, no parcelas), the webhook runs `findMatchingPendingBoleto`:

- Search window: `transactions` rows with `status='Pendente'`, `type='despesa'`, same `user_id` and `company_id` context, `payment_date` between today−180d and today+30d (limit 50).
- Scoring (0–3): supplier (id equal OR Jaccard ≥ 0.5 OR substring on contact_name), amount (≤ R$0,02 or 0.5% diff), description/notes (Jaccard ≥ 0.4).
- Hard filter: candidate amount must be within max(R$2, 10%) of the new amount.
- If best score ≥ 2 → create `whatsapp_pending_actions` row of `action_type='confirm_boleto_match'` (10 min TTL) with the matched transaction id and a `fallback_tx` payload for the "Não" path.
- User replies *Sim* → UPDATE existing transaction to status=Pago, set payment_date/account/wallet/method/attachment from the proof. No new row in `ai_pending_transactions`.
- User replies *Não* → inserts the fallback into `ai_pending_transactions` (the original flow).
