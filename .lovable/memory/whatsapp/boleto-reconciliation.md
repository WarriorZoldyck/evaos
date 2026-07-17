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
- Sugestão de baixa viaja **na mesma mensagem** do `respond()` principal (`boletoSuggestionTail` = separador + descrição/valor/venc. + "Responda 1/2/3" + deep link `?pending=<id>&ctx=<company_id|personal>`). Isso garante que o usuário sempre veja o match e as opções, independente de imagem/lista chegarem.
- Complementarmente, EVA renderiza um card claro em PNG via `_shared/whatsapp-boleto-card.ts` (satori + @resvg/resvg-wasm; card espelha o `PendingCard` — branco, chip do tipo, chip PENDENTE, descrição, `👤` fornecedor, `🏦` banco, VALOR colorido, VENCIMENTO, selo EVA OS) e envia via `sendEvolutionImage` (`POST /message/sendMedia`) com caption curta ("responda 1/2/3 na mensagem anterior"). Depois tenta `sendEvolutionList` (menu clicável) e, se falhar, o legado `sendEvolutionButtons`.
- **CRÍTICO:** o dispatch de imagem/lista **precisa** de `EdgeRuntime.waitUntil(dispatch)`. Sem isso o isolate do Supabase Edge encerra assim que `respond()` retorna e nenhum sendMedia/sendList chega ao WhatsApp — foi exatamente o bug observado.
- Logs obrigatórios no dispatch (`boleto dispatch: rendering PNG…`, `PNG bytes`, `sendMedia result`, `sendList result`, `sendButtons fallback result`) para diagnosticar falhas silenciosas.

Pending-action dispatcher (`confirm_boleto_match`):
- The webhook reads responses from `msgContent.buttonsResponseMessage.selectedButtonId`, `templateButtonReplyMessage.selectedId`, and `listResponseMessage.singleSelectReply.selectedRowId` and forwards them into the `message` variable, so text/button/list paths share the same code.
- `confirm_baixa` (or `sim`/`isso`/`1`/…): UPDATE `transactions SET status='Pago', payment_date/bank_account_id/wallet_id/payment_method/attachment_url=<from payload>` on `transaction_id`, then UPDATE `ai_pending_transactions SET status='approved'` on `pending_id`. Reply: "✅ Baixa feita!".
- `reject_baixa` (or `não`/`2`): strips the `[SUGESTAO_BAIXA]` block from `ai_pending_transactions.notes` so the card becomes a plain pending suggestion. Reply: mantido como lançamento novo.
- `open_edit` (or `editar`/`3`): replies with the `?edit=1&ctx=…` deep link. No mutation.

Análises EVA UI (`src/pages/AnalisesEva.tsx` → `PendingCard`):
- `parseBoletoSuggestion(notes)` extracts the block and shows the "Possível baixa de pendente" badge and reconcile button (still works for users who prefer approving in-app).
- Page reads `?pending=<id>&edit=1&ctx=<company_id|personal>` from `useSearchParams`. If `ctx` is present and differs from `selectedCompanyId`, it calls `setSelectedCompanyId(...)` first and waits for the pendings to refetch under the new contexto. If `ctx` is absent and the target isn't found in the current context, it queries `ai_pending_transactions.company_id` and auto-switches. Then scrolls to `#pending-card-<id>`, adds a temporary `ring-2 ring-primary` highlight (4s) and — if `edit=1` — opens the edit modal via `setEditingItem`. `ctx` is cleaned from the URL along with `pending`/`edit`.

Environment: optional `APP_BASE_URL` secret overrides the default `https://eva.tec.br` used in deep links.

## Ações rápidas em todo lançamento novo (`new_tx_actions`)

Em **qualquer** lançamento novo criado via WhatsApp (fluxo single-transaction, quando NÃO há match de boleto), o webhook agora:

- Grava `whatsapp_pending_actions` com `action_type='new_tx_actions'`, TTL 10 min, `payload = { pending_id, ctx, transaction_status }`.
- Anexa `newTxActionsTail` à mensagem principal do `respond()` com opções numeradas `1 ✅ Aprovar / 2 ❌ Cancelar / 3 ✏️ Editar no app` + deep-link `?pending=<id>&edit=1&ctx=<company_id|personal>`.
- Dispara `sendEvolutionList` (com fallback `sendEvolutionButtons`) via `EdgeRuntime.waitUntil(...)` com rows `approve_tx / cancel_tx / open_edit_tx`.

Quando **há** match de boleto, o menu do `confirm_boleto_match` continua sendo o único (evita dois pending_actions competindo — o dispatcher lê apenas o mais recente).

Dispatcher `new_tx_actions`:
- `approve_tx` / `1` / `sim`|`aprovar`: lê `ai_pending_transactions` pelo `pending_id`, INSERT completo em `transactions` (mesma projeção do `approveSingle` do hook `useAIPendingTransactions`) e UPDATE `ai_pending_transactions SET status='approved'`. Reply: "✅ Lançamento aprovado".
- `cancel_tx` / `2` / `não`|`cancelar`: UPDATE `ai_pending_transactions SET status='rejected'`. Reply: "🗑️ Lançamento cancelado".
- `open_edit_tx` / `3` / `editar`: responde com o deep-link `?pending=<id>&edit=1&ctx=…` (nenhuma mutação).

Handler colocado **antes** de `confirm_boleto_match` no dispatcher para evitar colisão de padrões numéricos `1/2/3`.
