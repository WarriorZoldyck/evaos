

## Problem Analysis

The WhatsApp webhook (EVA AI) has two critical issues when creating transactions:

1. **Category stored as text name instead of UUID**: The frontend (`CategorySelectWithCreate`) stores category as the UUID (`c.id`), but the webhook stores it as the raw text name from the AI response. While the display layer handles both formats via fallback, this creates inconsistency -- filters, reports, and subcategory hierarchy lookups may miss webhook-created transactions.

2. **Subcategory not validated or resolved**: The AI may return a subcategory name, but it is never validated against the actual child categories of the matched parent. It is stored as raw text, not as a UUID.

3. **Category name case mismatch**: The AI may return "alimentação" while the DB has "Alimentação". The validation uses `.toLowerCase()` but stores the AI's version, not the canonical DB name.

4. **"Outros" fallback may not exist**: When no category matches, the webhook falls back to `"Outros"` which may not exist as a category in that context, resulting in an orphan text value.

5. **Wallet selection missing**: The webhook only resolves `bank_account_id` but never considers wallets, even if the user only has wallets in that context.

---

## Plan

Modify `supabase/functions/whatsapp-webhook/index.ts` to properly resolve categories and subcategories to UUIDs, matching the frontend behavior:

### 1. Resolve category to UUID with proper fallback

After the AI returns a category name, find the matching category record in the context and store its **UUID** instead of the name. If no match, try a global "Outros" category for that context; if that also doesn't exist, store the first available category UUID for the context.

### 2. Resolve subcategory to UUID

If the AI returns a subcategory, find it as a child of the matched parent category (by `parent_id`) and store its UUID. If not found, set subcategory to `null`.

### 3. Store canonical names (not AI output)

When resolving, always use the exact name from the database record, not the AI's approximation.

### 4. Add wallet fallback

If no bank accounts exist in the context but wallets do, assign the first wallet via `wallet_id`.

### 5. Improve AI prompt for category matching

Add category IDs to the prompt so the AI can return them directly, reducing fuzzy matching needs.

---

### Technical Changes (single file)

**`supabase/functions/whatsapp-webhook/index.ts`** -- lines ~311-342 (lancamento handler):

```typescript
// After resolveContext returns companyId:
const contextCategories = categories.filter((c) => c.company_id === companyId);

// Find matching parent category (case-insensitive)
let matchedCategory = contextCategories.find(
  (c) => !c.parent_id && c.name.toLowerCase() === (parsed.category || "").toLowerCase()
);

// Fallback: try partial match
if (!matchedCategory) {
  matchedCategory = contextCategories.find(
    (c) => !c.parent_id && c.name.toLowerCase().includes((parsed.category || "").toLowerCase())
  );
}

// Fallback: "Outros" category in context
if (!matchedCategory) {
  matchedCategory = contextCategories.find(
    (c) => !c.parent_id && c.name.toLowerCase() === "outros"
  );
}

// Final fallback: first root category in context
if (!matchedCategory && contextCategories.length > 0) {
  matchedCategory = contextCategories.find((c) => !c.parent_id) || contextCategories[0];
}

const categoryValue = matchedCategory?.id || "Outros";

// Resolve subcategory under the matched parent
let subcategoryValue: string | null = null;
if (parsed.subcategory && matchedCategory) {
  const matchedSub = contextCategories.find(
    (c) => c.parent_id === matchedCategory!.id &&
      c.name.toLowerCase() === parsed.subcategory.toLowerCase()
  );
  subcategoryValue = matchedSub?.id || null;
}

// Account resolution: bank > wallet
const contextAccounts = accounts.filter((a) => a.company_id === companyId);
const contextWallets = wallets.filter((w) => w.company_id === companyId);
let bankAccountId: string | null = null;
let walletId: string | null = null;

if (contextAccounts.length > 0) {
  bankAccountId = contextAccounts[0].id;
} else if (contextWallets.length > 0) {
  walletId = contextWallets[0].id;
}

// Insert with UUIDs
await supabase.from("transactions").insert({
  // ... existing fields ...
  category: categoryValue,        // UUID instead of text name
  subcategory: subcategoryValue,   // UUID instead of text name
  bank_account_id: bankAccountId,
  wallet_id: walletId,
});
```

Also update the confirmation message to display the resolved category name (from DB) instead of the AI's raw output:

```typescript
const categoryLabel = matchedCategory?.name || parsed.category || "Outros";
```

