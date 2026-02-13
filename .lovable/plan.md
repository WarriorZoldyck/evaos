

## Correção dos Lançamentos Existentes de Maquininha

### Situação Atual

Analisei todas as transações vinculadas a terminais (maquininhas) no banco de dados. Os problemas encontrados:

| Transação | Valor Atual | Original | Parcelas | Taxa Correta | Valor Correto | Status |
|-----------|------------|----------|----------|-------------|--------------|--------|
| Teste cartão D+2 | R$960 | R$1.000 | 2x (4%) | 4% | R$960 | OK |
| hugo | R$9.671 | R$9.671 | 10x | 3.29% (sem taxa 10x) | R$9.352,82 | ERRADO |
| paciente XYZ | R$9.356 | R$9.356 | 5x (6.44%) | 6.44% | R$8.753,48 | ERRADO |
| Tancredo | R$3.868,40 | sem registro | 1x (3.29%) | 3.29% | R$3.741,12 | ERRADO |
| Maria da Conceição | R$198,02 | R$198,02 | débito (0.99%) | 0.99% | R$196,06 | ERRADO |
| teste 12/01 | R$947,60 | R$947,60 | 3x (5.24%) | 5.24% | R$897,95 | ERRADO |
| E outros... | | | | | | |

Além disso, algumas datas de pagamento (D+) também precisam ser recalculadas.

---

### Plano de Correção

Criar uma **Edge Function** temporária chamada `fix-terminal-transactions` que:

1. Busca todas as transações com `card_terminal_id` preenchido
2. Para cada transação, busca o terminal vinculado e suas taxas
3. Determina a taxa correta:
   - Débito: usa `debit_rate`
   - Crédito à vista (1x): usa `credit_rate`
   - Crédito parcelado: busca na tabela `rates_info` pelo número de parcelas; se não encontrar, usa `credit_rate`
4. Recalcula:
   - `original_amount` = valor atual (se ainda não preenchido)
   - `amount` = original_amount - (original_amount * taxa / 100)
   - `payment_date` = competence_date + settlement_days (débito ou crédito)
5. Atualiza cada transação no banco

A função será chamada uma única vez pelo usuário e poderá ser removida depois.

---

### Segurança

- A função só atualiza transações que têm `card_terminal_id` preenchido
- Preserva o `original_amount` (valor bruto) para referência
- Transações já corrigidas (como "Teste cartão D+2") não serão afetadas porque a lógica detecta que `original_amount != amount`
- Para transações sem `original_amount` (como "Tancredo"), o valor atual será tratado como bruto

---

### Detalhes Técnicos

```text
Lógica de decisão por transação:

SE original_amount é NULL:
  original_amount = amount (valor atual é o bruto)

SE original_amount == amount (taxa nunca foi aplicada):
  Calcular taxa e atualizar amount para valor líquido

SE original_amount != amount (já foi corrigido):
  Pular (não mexer)

Para TODAS com terminal:
  Recalcular payment_date = competence_date + D+ dias
```

### Arquivos

1. **`supabase/functions/fix-terminal-transactions/index.ts`** - Edge Function que executa a correção
2. Após execução bem-sucedida, a função pode ser removida

