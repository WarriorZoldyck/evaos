

## Diagnosis

After reviewing the webhook code and the AI prompt, I identified the root causes of transactions landing in wrong places:

### Problem 1: AI returns category NAMES, not UUIDs
The prompt includes category IDs like `Alimentação[uuid-here]`, but the JSON response format instructs the AI to return `"category":"..."` as a name. The AI ignores the UUIDs and returns approximate names that often don't match exactly, causing the fallback chain to pick wrong or generic categories.

### Problem 2: No validation that required fields resolved correctly
If context resolution fails (e.g., AI hallucinates a company name), the system silently falls back to "Pessoal" and picks whatever category/account it finds -- or none at all. Transactions get created with `null` bank_account_id AND `null` wallet_id, becoming orphan records invisible in filtered views.

### Problem 3: AI prompt doesn't enforce strict context selection
The prompt says "Se o usuário não especificar o contexto, use 'Pessoal'" but doesn't strongly constrain the AI to ONLY pick from the available context names. The AI sometimes invents or mismatches contexts.

### Problem 4: Category type not enforced
The AI picks "despesa" categories for "receita" transactions and vice versa because the prompt doesn't enforce matching `category.type` with `transaction.type`.

---

## Plan

### 1. Make the AI return UUIDs directly (not names)

Change the AI response format to require `category_id` and `subcategory_id` instead of text names. Update the prompt to clearly instruct: "Return the exact UUID from the brackets `[uuid]` in the category list."

```
// New response format in prompt:
{"intent":"lancamento","description":"...","amount":0.00,"type":"receita|despesa",
 "category_id":"uuid-from-list","subcategory_id":"uuid-or-null",
 "context":"Pessoal|Nome da Empresa","date":"YYYY-MM-DD","friendly_message":"..."}
```

### 2. Add strict validation after AI response

After parsing the AI response, validate that:
- `context` matches exactly one of the available context names
- `category_id` exists in the database for that context
- If the AI returned a name instead of UUID, still do the fallback resolution
- `bank_account_id` or `wallet_id` is resolved (reject if neither exists)

### 3. Filter categories by transaction type

When resolving categories, filter by `type` matching the transaction type (or `type === "ambos"`), so expense categories aren't assigned to income transactions.

### 4. Add account list with IDs to the prompt

Include account/wallet IDs in the prompt so the AI can also suggest which account to use, with the same UUID pattern.

### 5. Block transactions with missing required fields

If no account (bank or wallet) exists for the resolved context, return an error message to the user instead of creating an orphan transaction: "Você não tem uma conta bancária ou carteira cadastrada no contexto [X]. Cadastre uma antes de lançar."

### 6. Add confirmation with resolved values in logs

Enhance the debug logging to show exactly what the AI returned vs what was resolved, making future debugging easier.

---

### Technical Changes

**Single file: `supabase/functions/whatsapp-webhook/index.ts`**

1. **Lines 153-181** -- Update `buildCategoryList` and `buildAccountList` to format IDs more prominently and include type filtering guidance
2. **Lines 193-234** -- Rewrite the system prompt to:
   - Require UUID responses for category/subcategory
   - List context names as an enum (not free text)
   - Enforce type matching (receita categories for receita, despesa for despesa)
   - Include account/wallet IDs
3. **Lines 311-405** -- Rewrite the lancamento handler to:
   - First try UUID from AI response directly
   - Fall back to name matching if AI returned a name
   - Filter categories by matching type (receita/despesa/ambos)
   - Validate account exists or return user-friendly error
   - Block insert if critical fields are missing
4. **Lines 560-580** -- Fix `resumo_mes` to resolve category UUIDs to names for display (since categories are now stored as UUIDs)

