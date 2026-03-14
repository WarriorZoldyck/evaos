

## Problem

Currently, when EVA can't match a category, it silently falls back to "Outros" or the first available category — effectively inventing a classification. The user wants:

1. **Never invent categories** — if no match, tell the user
2. **If user confirms**, create the category AND the transaction in one flow
3. **No changes to N8N** — only the Edge Function changes

## Challenge: Stateless Webhook

The webhook is stateless — each message is independent. When EVA asks "Quer que eu crie a categoria X?", the next message ("sim") has no memory of what was pending. We need **temporary state**.

## Solution

### 1. New table: `whatsapp_pending_actions`

Stores the full transaction payload when a category can't be resolved. Auto-expires after 10 minutes.

```
id, user_id, action_type, payload (jsonb), category_name, category_type,
context_company_id, created_at, expires_at
```

### 2. Updated flow in `whatsapp-webhook/index.ts`

**Before processing any message**, check if the user has a pending action:
- If user says "sim/pode/cria" and a pending action exists → create the category, then create the transaction using the stored payload. Delete the pending row.
- If user says "não/cancela" → delete the pending row, respond confirming cancellation.

**During transaction creation**, replace the fallback chain (Steps 4-6 that pick "Outros" or first category):
- If no category matches → save pending action → respond: "Não encontrei a categoria 'X' no contexto Y. Quer que eu crie?"
- The AI prompt will also be updated to include a new instruction: "Se nenhuma categoria se encaixar, retorne `category_id: null` e `suggested_category_name` com o nome que faria sentido."

### 3. AI prompt changes

Add to the response format:
```json
{
  "category_id": "UUID-ou-null",
  "suggested_category_name": "nome sugerido se category_id for null"
}
```

Add rule: "Se NENHUMA categoria da lista se encaixar, retorne category_id como null e preencha suggested_category_name. NÃO invente UUIDs. NÃO escolha uma categoria que não faça sentido."

### 4. Confirmation detection

Add logic at the start of message processing to detect confirmation patterns ("sim", "pode criar", "cria", "ok") when a pending action exists, using simple string matching (no AI call needed for this).

---

### Files changed

1. **`supabase/functions/whatsapp-webhook/index.ts`** — Add pending action check at start, replace category fallback with pending flow, update AI prompt
2. **New migration** — Create `whatsapp_pending_actions` table with RLS and auto-expiry

### What stays the same
- N8N payload format (phone + message) — zero changes
- All existing intents (consulta, conversa, resumo) work identically
- Valid category matches work exactly as before

