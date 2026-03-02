

# Correção: Lançamento Cartão de Crédito D+30 Parcelado

## Problema Atual

Quando um lançamento de receita via maquininha é parcelado (ex: R$ 300 em 3x no crédito D+30), o sistema salva **uma única transação** com o valor líquido total (R$ 300 - MDR = ~R$ 285), com data de recebimento D+30 a partir da venda.

**Comportamento errado:** Valor total líquido em uma única data, como se fosse antecipação.

**Comportamento correto:** Cada parcela deve ser um lançamento individual:
- Parcela 1/3: R$ 95 líquido, vencimento D+30 da venda
- Parcela 2/3: R$ 95 líquido, vencimento D+60 da venda
- Parcela 3/3: R$ 95 líquido, vencimento D+30×3 da venda

Cada parcela = (valor bruto / nº parcelas) - MDR da parcela, com datas espaçadas de 30 em 30 dias (ou o valor configurado no `settlement_days_credit` da maquininha).

## Plano de Implementação

### 1. Alterar lógica de submit no TransactionFormModal (linhas 610-617)

O bloco `else if (selectedTerminal)` que hoje salva sempre como transação única será reescrito:

- **Débito ou crédito à vista:** Mantém comportamento atual (1 transação, valor líquido total, D+ único)
- **Crédito parcelado:** Gera N transações (uma por parcela):
  - `series_id` compartilhado (UUID)
  - Valor bruto de cada parcela = `amount / installments_count`
  - MDR aplicado sobre cada parcela individualmente
  - `amount` = valor líquido da parcela
  - `original_amount` = valor bruto da parcela (antes do MDR)
  - `payment_date` da parcela N = competence_date + (settlement_days × N) em dias corridos (30, 60, 90...)
  - `competence_date` = data da venda (fixa para todas)
  - `installment_number` e `installments_total` preenchidos

### 2. Atualizar cálculo MDR para parcelas

O MDR já é calculado sobre o valor total. Para parcelado, precisa calcular sobre cada parcela individual:
- Valor bruto parcela = total / nº parcelas
- MDR parcela = bruto parcela × taxa%
- Líquido parcela = bruto parcela - MDR parcela

### 3. Atualizar MdrInfoCard para mostrar info por parcela

Quando parcelado, o card deve mostrar:
- Valor bruto por parcela
- MDR por parcela
- Líquido por parcela
- Datas de recebimento: D+30, D+60, D+90...

### 4. Atualizar edge function fix-terminal-transactions

A edge function que corrige retroativamente também precisa tratar parcelas corretamente, respeitando o mesmo cálculo por parcela.

## Detalhes Técnicos

### Cálculo de datas (D+30 parcelado)

Para settlement_days_credit = 30 (dias corridos, não úteis para D+30):
```
Parcela 1: competence_date + 30 dias
Parcela 2: competence_date + 60 dias
Parcela 3: competence_date + 90 dias
```

Nota: D+30 usa dias corridos (não úteis). A função `addBusinessDays` só se aplica a D+1, D+2 etc. Para D+30, usaremos `addDays` (dias corridos).

### Lógica no submit (pseudo-código)

```typescript
if (selectedTerminal && data.is_installment && installments >= 2) {
  const seriesId = crypto.randomUUID();
  const grossPerInstallment = Math.round((data.amount / count) * 100) / 100;
  const feePerInstallment = Math.round(grossPerInstallment * (rate / 100) * 100) / 100;
  const netPerInstallment = grossPerInstallment - feePerInstallment;
  const settlementDays = terminal.settlement_days_credit ?? 30;
  
  for (let i = 0; i < count; i++) {
    const payDate = addDays(data.competence_date, settlementDays * (i + 1));
    installments.push({
      ...baseData,
      amount: netPerInstallment,
      original_amount: grossPerInstallment,
      payment_date: format(payDate, "yyyy-MM-dd"),
      competence_date: format(data.competence_date, "yyyy-MM-dd"),
      series_id: seriesId,
      installment_number: i + 1,
      installments_total: count,
    });
  }
  success = await onSaveMultiple(installments);
}
```

### Arquivos alterados
- `src/components/lancamentos/TransactionFormModal.tsx` — lógica de submit parcelado via terminal
- `src/components/lancamentos/MdrInfoCard.tsx` — exibição por parcela quando parcelado
- `supabase/functions/fix-terminal-transactions/index.ts` — correção retroativa

