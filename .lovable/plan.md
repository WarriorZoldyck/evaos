

# Status das Correções e Bugs Remanescentes

## 1. MDR mostrando taxa de 1x no card de detalhes

**Status: CORRIGIDO** na última edição. O `TransactionDetailModal.tsx` (linhas 88-104) agora busca a taxa específica de parcelas em `rates_info` quando `installments_total >= 2`. Após a correção do D+30 (que salva cada parcela individualmente com `installments_total` correto), o card deve exibir a taxa correta.

Se o problema persistir, pode ser com lançamentos **antigos** criados antes da correção, que foram salvos como transação única sem `installments_total` preenchido, fazendo o fallback para `credit_rate`.

## 2. Dashboard "Próximos Lançamentos" com valor de fatura divergente

**Status: BUG REMANESCENTE.** Em `UpcomingTransactions.tsx` linha 125:

```typescript
bill.total += Number(t.amount);
```

Soma todos os `t.amount` sem considerar o tipo. Transações de `receita` no cartão (estornos, créditos) são somadas em vez de subtraídas. Esta é a **mesma** correção aplicada ao `CreditCardBillPaymentModal`, mas que **não foi replicada** no widget do Dashboard.

### Correção

Em `src/components/dashboard/UpcomingTransactions.tsx`, linha 125, alterar para:

```typescript
bill.total += t.type === "receita" ? -Number(t.amount) : Number(t.amount);
```

### Arquivo alterado
- `src/components/dashboard/UpcomingTransactions.tsx` — corrigir soma da fatura no widget do Dashboard

