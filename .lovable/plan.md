

# Fix: MDR Rate Display in Transaction Detail Card

## Problem

The `TransactionDetailModal` always uses `terminal.credit_rate` (the 1x/a vista rate) when displaying MDR details for credit card transactions, even when the transaction was actually charged at a different installment-specific rate from `rates_info`.

**Example:** A 3x installment transaction uses a 4.5% rate (from `rates_info`), but the detail card shows the 1x rate of 2.5%. The actual `amount` saved in the database is correct (calculated with 4.5%), but the display is wrong.

**Root cause:** Lines 87-91 of `TransactionDetailModal.tsx`:
```typescript
} else {
  // Always use credit_rate (merchant receives based on à vista rate)
  mdrRate = terminal.credit_rate || 0;
}
```
This ignores `rates_info` and `installments_total` entirely.

## DRE Impact

The DRE uses `t.amount` directly from the database, which is the net amount (already correctly calculated with the right rate at creation time). So the DRE is **correct** — it reflects the actual MDR deducted. The bug is display-only in the detail modal.

## Fix

### 1. TransactionDetailModal — Use correct installment rate

Update the MDR calculation block to mirror the same logic used in `MdrInfoCard` and `TransactionFormModal`:

- If credit card with `installments_total >= 2`: parse `rates_info`, find matching rate, fall back to `credit_rate`
- Otherwise: use `credit_rate` (1x) or `debit_rate`

This is a ~10-line change in the existing MDR rate selection block (lines 82-91).

### Files changed
- `src/components/lancamentos/TransactionDetailModal.tsx` — fix MDR rate lookup to use `rates_info` for installments

