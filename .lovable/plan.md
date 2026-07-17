
## Objetivo

Após qualquer novo lançamento criado via WhatsApp, a **primeira mensagem de retorno** já traz as ações interativas:

1. ✅ **Aprovar** — confirma o lançamento (status = `Pago`)
2. ❌ **Cancelar** — exclui o lançamento recém-criado
3. ✏️ **Editar no app** — deep-link para Análises EVA no card correto (mantido, já existe)

Aparece em **todo lançamento novo**, independente de haver match com boleto pendente. Quando houver match, as opções de "dar baixa em pendente" continuam aparecendo abaixo (fluxo atual preservado).

## Formato

- **Lista clicável Evolution** (`sendList`) — mesmo helper `sendEvolutionList` já usado no fluxo de boleto.
- **Fallback numerado** no corpo da própria mensagem (`1 — Aprovar`, `2 — Cancelar`, `3 — Editar no app`) para quando o WhatsApp do usuário não renderizar a lista.
- **Envio dentro de `EdgeRuntime.waitUntil(...)`** (mesmo padrão do fluxo de boleto) para garantir que o isolate não morra antes do `sendList`.

## Mudanças

### `supabase/functions/whatsapp-webhook/index.ts`

1. **Após criar transação** (no ponto onde hoje monta `respond()` com "Lançamento enviado para aprovação"):
   - Adicionar bloco `newTxActionsTail` com o texto numerado `1/2/3` + deep-link `?ctx=...&highlight=<id>&action=edit`.
   - Concatenar `newTxActionsTail` na mensagem principal do `respond()`, **antes** do `boletoSuggestionTail` (quando existir).
2. **Dispatch da lista clicável** dentro do bloco `EdgeRuntime.waitUntil(...)` existente (ou criar um novo quando não houver match de boleto):
   - `sendEvolutionList` com título "Ações do lançamento" e 3 rows: `approve_tx`, `cancel_tx`, `open_edit_tx` (payload inclui `transaction_id`).
   - Persistir em `whatsapp_pending_actions` (TTL 10 min, padrão atual) com `type='new_tx_actions'` + `payload={ transaction_id, user_id, context }` para resolver a resposta.
3. **Dispatcher de resposta** (onde hoje trata `confirm_baixa` / `reject_baixa` / `open_edit`):
   - `approve_tx` / texto `1` → `UPDATE transactions SET status='Pago' WHERE id=... AND user_id=...`; confirma com "✅ Lançamento aprovado".
   - `cancel_tx` / texto `2` → `DELETE FROM transactions WHERE id=... AND user_id=...` (respeitando `enforce_closed_bill_cycle`); confirma "🗑️ Lançamento cancelado".
   - `open_edit_tx` / texto `3` → responde com o deep-link (mesmo do tail).
   - Resposta numerada só é interpretada como ação se houver um `whatsapp_pending_actions` do tipo `new_tx_actions` ativo para o número — evita colisão com o `1/2/3` do fluxo de boleto (que já grava seu próprio pending action separado).
4. **Regra de exibição**: aparece em todo `INSERT` novo. Se o lançamento já foi criado como `Pago` (fluxo direto), a lista mostra apenas **Cancelar** + **Editar** (omite Aprovar) — pequena condicional no builder da lista.

### Sem mudanças no frontend

O deep-link `?ctx=...&highlight=...&action=edit` já é tratado em `src/pages/AnalisesEva.tsx`.

### Memória

- Atualizar `.lovable/memory/whatsapp/boleto-reconciliation.md` (ou criar `mem://whatsapp/new-tx-actions`) descrevendo o novo `pending_action.type = 'new_tx_actions'` e o mapping dos IDs da lista.
- Adicionar entrada correspondente em `mem://index.md`.

## Fora do escopo

- Nenhuma mudança visual no card PNG.
- Nenhuma mudança no fluxo de match de boleto existente (permanece somando suas próprias opções quando aplicável).
- Nenhuma mudança em `AnalisesEva.tsx` (deep-link já funciona).
