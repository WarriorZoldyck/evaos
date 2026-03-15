

## Problem

The current webhook only extracts basic fields (description, amount, type, category, date, account) but the `transactions` table supports many more fields that users expect to work:

**Missing fields:**
- `payment_method` (Pix, Dinheiro, Cartão de Débito, Cartão de Crédito, Boleto, Transferência)
- `credit_card_id` (for credit card purchases -- needs cycle date logic)
- `competence_date` vs `payment_date` (currently both set to the same date)
- `contact_name` / `supplier_id` / `client_id` (who the transaction is with)
- `status` (always hardcoded as "Pago" -- should be "Pendente" for future dates or credit card)
- `notes` (optional observations)

Additionally, credit card transactions need the closing/due date cycle logic to calculate the correct `payment_date`.

---

## Plan

### 1. Fetch credit cards alongside accounts/wallets

Add credit cards query to the context-loading step (line ~290):
```
supabase.from("credit_cards").select("id, name, last_four_digits, closing_day, due_day, company_id, bank_account_id")
```

Also fetch suppliers and clients for contact resolution:
```
supabase.from("suppliers").select("id, name").eq("user_id", userId)
supabase.from("clients").select("id, name").eq("user_id", userId)
```

### 2. Add credit cards and contacts to the AI prompt

Include in `buildAccountList`:
- Credit cards: `Cartões de Crédito: Nubank Final 1234[UUID], ...`

Add new section:
- `FORNECEDORES: Nome[UUID], ...`
- `CLIENTES: Nome[UUID], ...`

### 3. Expand AI response format

Update the prompt's JSON format to include:
```json
{
  "intent": "lancamento",
  "description": "...",
  "amount": 0.00,
  "type": "receita|despesa",
  "category_id": "UUID",
  "subcategory_id": "UUID|null",
  "suggested_category_name": "...|null",
  "context": "Pessoal|Empresa",
  "account_id": "UUID-conta-ou-carteira|null",
  "credit_card_id": "UUID-cartao|null",
  "payment_method": "pix|dinheiro|cartao_debito|cartao_credito|boleto|transferencia|null",
  "contact_name": "nome do contato|null",
  "supplier_id": "UUID|null",
  "client_id": "UUID|null",
  "competence_date": "YYYY-MM-DD",
  "payment_date": "YYYY-MM-DD|null",
  "status": "Pago|Pendente",
  "notes": "observações|null",
  "date": "YYYY-MM-DD",
  "friendly_message": "..."
}
```

Add rules:
- If `payment_method` is "cartao_credito", MUST return `credit_card_id` (UUID from list) instead of `account_id`
- If payment date is in the future, set `status: "Pendente"`
- `competence_date` = when the expense/income happened; `payment_date` = when money moves
- For credit card: `competence_date` = transaction date, `payment_date` will be calculated by the system based on card cycle

### 4. Credit card cycle date calculation

When `credit_card_id` is set, calculate `payment_date` using the card's `closing_day` and `due_day` (same logic already used in `TransactionFormModal`):
- If competence day >= closing_day → next cycle (due_day of next month or month after)
- Set `bank_account_id` from the credit card's `bank_account_id`

### 5. Contact/supplier/client resolution

After AI response:
- If `supplier_id` UUID returned → validate it exists
- If `client_id` UUID returned → validate it exists  
- If only `contact_name` returned → store in `contact_name` field
- For despesa: try to match supplier; for receita: try to match client

### 6. Smart status detection

- If `payment_date` is in the future → `status: "Pendente"`
- If `credit_card_id` is set → `status: "Pendente"` (will be paid on bill)
- Otherwise respect AI's suggestion, default to "Pago"

### 7. Update the insert to include all new fields

The transaction insert (line ~718) will include:
`payment_method`, `credit_card_id`, `contact_name`, `supplier_id`, `client_id`, `notes`, proper `competence_date` vs `payment_date`, and correct `status`.

### 8. Update the confirmation response message

Include payment method, contact, and account info in the success message.

---

### Files changed

**Single file: `supabase/functions/whatsapp-webhook/index.ts`**

- Lines 289-300: Add credit cards, suppliers, clients to context queries
- Lines 329-351: Add credit cards to `buildAccountList`, add new `buildContactList`
- Lines 362-422: Expand AI system prompt with new fields, rules, and contact lists
- Lines 648-731: Add credit card resolution with cycle logic, contact resolution, status logic, expanded insert

### Updated cURL examples (after implementation)

**Despesa no cartão de crédito:**
```bash
curl -X POST .../whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET_AQUI" \
  -d '{"phone":"5511999999999","message":"Comprei um tênis de 350 reais no cartão Nubank"}'
```
→ EVA resolves: credit_card_id=Nubank UUID, payment_method=cartao_credito, competence_date=today, payment_date=calculated from cycle, status=Pendente

**Receita via Pix:**
```bash
curl -X POST .../whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET_AQUI" \
  -d '{"phone":"5511999999999","message":"Recebi 2000 do cliente João via pix"}'
```
→ EVA resolves: client_id (if "João" matches), payment_method=pix, status=Pago, type=receita

