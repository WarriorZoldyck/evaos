

## Correcao do Faturamento - Valor Bruto Total por Competencia

### Problema

Quando uma venda de R$1000 e parcelada em 4x de R$250, cada parcela tem uma `competence_date` diferente (Fev, Mar, Abr, Mai). No mes de Fevereiro, o faturamento mostra apenas R$250 (a parcela 1), quando deveria mostrar R$1000 (o valor bruto total da venda).

### Solucao

No calculo do faturamento, tratar transacoes parceladas de forma especial:

- **Transacao avulsa** (sem `series_id`): usar `amount` normalmente
- **Parcela 1 de uma serie** (`installment_number === 1`): usar o valor bruto total. Calculado como `amount * installments_total` (ou `original_amount` quando disponivel e maior que o amount)
- **Parcelas 2+ de uma serie** (`installment_number > 1`): ignorar no calculo do faturamento (ja foi contabilizado na parcela 1)

### Exemplo com dados reais

Venda "Teste cartao D+2": series_id = 2126bea4
- Parcela 1: amount=250, installments_total=4, competence=2026-02-10
- Parcela 2: amount=250, competence=2026-03-10
- Parcela 3: amount=250, competence=2026-04-10
- Parcela 4: amount=250, competence=2026-05-10

**Hoje**: Faturamento de Fevereiro = R$250
**Correto**: Faturamento de Fevereiro = R$1.000 (250 x 4)

### Detalhes Tecnicos

**Arquivo: `src/hooks/useDashboardData.ts`**

Alterar o calculo do `faturamento` no `useMemo` do summary:

```text
// Para cada transacao de receita no periodo por competencia:
if (sem series_id) {
  faturamento += amount
} else if (installment_number === 1) {
  // Valor bruto = parcela * total de parcelas
  faturamento += amount * installments_total
} else {
  // Parcelas 2+ sao ignoradas no faturamento
  // (ja contabilizadas na parcela 1)
}
```

Sera necessario adicionar `installment_number`, `installments_total` e `original_amount` ao select das queries de competencia, pois hoje esses campos nao sao buscados.

**Nota**: Os demais calculos (entradas, saidas, saldo, previsto, consolidado) permanecem iguais -- eles trabalham com fluxo de caixa real por `payment_date`.

### Arquivo modificado

- `src/hooks/useDashboardData.ts` (unico arquivo)

