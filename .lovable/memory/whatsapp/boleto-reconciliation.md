---
name: WhatsApp Boleto Reconciliation
description: EVA detects a matching Pendente when the user pays a boleto by WhatsApp and offers Sim/Não/Editar via reply-buttons; user may confirm the baixa in-chat OR in Análises EVA.
type: feature
---

When the user sends a payment proof for a despesa via WhatsApp (status=Pago, no credit card, no parcelas), the webhook runs `findMatchingPendingBoleto`:

- Search window: `transactions` rows with `status='Pendente'`, `type='despesa'`, same `user_id`/`company_id`, `payment_date` between today−365d and today+60d (limit 100).
- Scoring 0–4 (all binary signals): supplier (id equal OR supplierJaccard ≥ 0.4 on legal-entity-stripped tokens OR substring on the stripped core), amount (≤ R$5 or 3% diff), description/notes (Jaccard ≥ 0.35), date proximity (payment_date within ±10 days).
- Hard filter: candidate discarded only if amount differs by more than max(R$20, 15%).
- Helpers: `normalizeBoletoText`, `normalizeSupplierCore` (removes `sa/ltda/me/ind/com/de/…`), `tokenSet`, `supplierTokenSet`, `jaccardSimilarity`, `supplierJaccard`, `amountMatches`, `daysBetween`. Do NOT rename `normalizeBoletoText` — it collides with another function in the same file. Near-matches (score=1) are logged so future false-negatives can be diagnosed.

If best score ≥ 2:
- The new transaction is inserted into `ai_pending_transactions` (normal flow), **plus** a structured block appended to `notes`:
  ```
  [SUGESTAO_BAIXA]
  transaction_id: <uuid>
  descricao: ...
  valor: 123.45
  vencimento: YYYY-MM-DD
  fornecedor: ...
  score: 2
  ```
- A `whatsapp_pending_actions` row is created with `action_type='confirm_boleto_match'` (expires in 10 min) carrying `{ pending_id, transaction_id, amount, description, payment_date, bank_account_id, wallet_id, payment_method, attachment_url }` in `payload`. `suggested_category_name` and `category_type` are stored as empty strings (NOT NULL columns unused by this action).
- Fire-and-forget: EVA renders a **light-theme** card as PNG via `_shared/whatsapp-boleto-card.ts` (satori + @resvg/resvg-wasm, Inter loaded from jsdelivr; card mirrors the Análises EVA look — white background, type chip, PENDENTE chip, descrição, fornecedor `👤`, banco `🏦`, VALOR colorido por tipo, VENCIMENTO, selo EVA OS). Sent via `sendEvolutionImage` (`POST /message/sendMedia`). Caption contains the suggestion text + deep link `${APP_BASE_URL}/analises-eva?pending=<id>&ctx=<company_id|personal>` + a numbered fallback (`1 — Sim, 2 — Não, 3 — Editar`) so the user can respond even sem botões. If PNG rendering fails, falls back to text-only reply.
- Interactive controls: WhatsApp deprecated the classic `buttonsMessage`; use `sendEvolutionList` (`POST /message/sendList`) as primary — renders as a "Escolher opção" menu with 3 rows (`confirm_baixa`, `reject_baixa`, `open_edit`). Only if `sendList` fails, fall back to the legacy `sendEvolutionButtons`. Never rely on buttons alone — always include the numbered fallback in the caption.
- The main HTTP `respond({message})` deliberately OMITS the suggestion text when a match exists (buttons/card carry it) — else duplicates would arrive.

Pending-action dispatcher (`confirm_boleto_match`):
- The webhook reads responses from `msgContent.buttonsResponseMessage.selectedButtonId`, `templateButtonReplyMessage.selectedId`, and `listResponseMessage.singleSelectReply.selectedRowId` and forwards them into the `message` variable, so text/button/list paths share the same code.
- `confirm_baixa` (or `sim`/`isso`/`1`/…): UPDATE `transactions SET status='Pago', payment_date/bank_account_id/wallet_id/payment_method/attachment_url=<from payload>` on `transaction_id`, then UPDATE `ai_pending_transactions SET status='approved'` on `pending_id`. Reply: "✅ Baixa feita!".
- `reject_baixa` (or `não`/`2`): strips the `[SUGESTAO_BAIXA]` block from `ai_pending_transactions.notes` so the card becomes a plain pending suggestion. Reply: mantido como lançamento novo.
- `open_edit` (or `editar`/`3`): replies with the `?edit=1&ctx=…` deep link. No mutation.

Análises EVA UI (`src/pages/AnalisesEva.tsx` → `PendingCard`):
- `parseBoletoSuggestion(notes)` extracts the block and shows the "Possível baixa de pendente" badge and reconcile button (still works for users who prefer approving in-app).
- Page reads `?pending=<id>&edit=1&ctx=<company_id|personal>` from `useSearchParams`. If `ctx` is present and differs from `selectedCompanyId`, it calls `setSelectedCompanyId(...)` first and waits for the pendings to refetch under the new contexto. If `ctx` is absent and the target isn't found in the current context, it queries `ai_pending_transactions.company_id` and auto-switches. Then scrolls to `#pending-card-<id>`, adds a temporary `ring-2 ring-primary` highlight (4s) and — if `edit=1` — opens the edit modal via `setEditingItem`. `ctx` is cleaned from the URL along with `pending`/`edit`.

Environment: optional `APP_BASE_URL` secret overrides the default `https://eva.tec.br` used in deep links.
