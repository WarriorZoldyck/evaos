## Correção: datas de recebimento parcelado no cartão (D+30)

### Bug

Em `src/components/lancamentos/MdrInfoCard.tsx`, linhas 109–114, o settlement (D+30) é somado **duas vezes**:

```ts
for (let i = 0; i < count; i++) {
  const vencimento = addDays(paymentDate, 30 * (i + 1));       // já +30, +60...
  installmentDates.push(addBusinessDays(vencimento, settlementDays)); // + outros ~30 úteis
}
```

Resultado para venda em julho, 2x: parcelas caem em 11/09 e 12/10 (agosto pulado, ~80 dias a mais).

### Regra correta

Parcela N (D+X, sem antecipação): `paymentDate + settlementDays + 30 * (N - 1)` dias corridos.
Para D+30, 2x → +30d e +60d. Para 3x → +30, +60, +90.

### Alteração

Único arquivo: `src/components/lancamentos/MdrInfoCard.tsx` (linhas 109–114). Substituir o loop por:

```ts
const installmentDates: Date[] = [];
for (let i = 0; i < count; i++) {
  installmentDates.push(addDays(paymentDate, settlementDays + 30 * i));
}
```

### Escopo / impacto

- **Não retroativo.** Só afeta o card de pré-visualização ao criar/editar lançamentos. Transações já salvas no banco permanecem inalteradas.
- Demais cálculos (débito, crédito à vista, lump sum com antecipação, taxa por parcela, MDR, líquidos) já estão corretos e não serão tocados.
- Sem mudanças de UI, sem mudanças em `TransactionFormModal`, sem migrações.

### Verificação

- Terminal D+30, venda hoje, 2x → parcelas em +30d e +60d.
- Terminal D+2/D+1 continua caindo em `lump_sum` (inalterado).
