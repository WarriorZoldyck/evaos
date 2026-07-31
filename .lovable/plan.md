# Sim, é um erro do sistema

Confirmei no banco. O cliente criou "Tech Bio - Drone antigo", R$ 773,31 em 3x no cartão Itaú João, com **Data de Competência 07/09/2025** e **Data de Pagamento 10/07/2026**. A prévia na tela mostrou corretamente 10/07/2026, 10/08/2026 e 10/09/2026.

O que foi realmente gravado:

```text
parcela 1/3 -> payment_date 2025-10-10
parcela 2/3 -> payment_date 2025-11-10
parcela 3/3 -> payment_date 2025-12-10
```

Por isso as parcelas não aparecem na fatura jul/2026 — elas caíram em faturas de out/nov/dez de 2025.

## Causa

Em `TransactionFormModal.tsx`, no bloco de parcelamento, quando a forma de pagamento é Cartão de Crédito o sistema **descarta a Data de Pagamento informada** e recalcula tudo a partir da Data de Competência com o ciclo do cartão (`getInstallmentDueDate`). Como a competência é de 2025 (compra antiga) e o pagamento é de 2026, o resultado saiu um ano atrasado. No mesmo caminho as datas editadas manualmente na tabela de prévia (`customInstallmentDates`) também são ignoradas — só valem para não-cartão.

Ou seja: **o que a prévia mostra não é o que é salvo** quando o lançamento é de cartão.

## Correção proposta

1. Passar a respeitar a data informada quando ela é explícita:
   - Se o usuário alterou a Data de Pagamento (ela deixou de acompanhar a competência) ou editou datas na tabela de parcelas, essas datas mandam.
   - O cálculo automático pelo ciclo do cartão continua valendo apenas quando a data de pagamento ainda é a sugerida pelo sistema (compra nova, fluxo normal).
2. Ao aplicar o ciclo do cartão, ancorar a 1ª parcela na data de pagamento efetiva e avançar mês a mês a partir dela, em vez de reancorar na competência.
3. Garantir que a tabela de prévia e o que é gravado usem exatamente a mesma função de cálculo (uma fonte única), para nunca mais divergirem.
4. Testes cobrindo: competência antiga + pagamento futuro, datas editadas manualmente, e o caso normal (compra do mês, ciclo do cartão).

## Limpeza dos dados do cliente

O cliente repetiu o lançamento 4 vezes tentando acertar — hoje existem **12 linhas** duplicadas (4 séries de 3 parcelas), todas com as datas erradas de 2025. Depois da correção, apago as duplicadas e reposiciono uma única série em 10/07, 10/08 e 10/09/2026.

## Arquivos afetados

- `src/components/lancamentos/TransactionFormModal.tsx` — bloco de geração de parcelas.
- `src/lib/creditCardDueDate.ts` — função de ancoragem a partir da data de pagamento.
- `src/components/lancamentos/InstallmentPreviewTable.tsx` — usar a mesma função.
- Script de correção pontual dos 12 registros do usuário (sem migração de schema).
