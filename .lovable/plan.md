
## Diagnóstico

Com base na fatura anexada, o problema não parece ser “só formato americano”. O PDF está claramente em `DD/MM` e mistura 3 cenários na mesma fatura:

- compras normais do ciclo atual: `23/12`, `30/12`, `01/01`, `02/01`
- parcelas antigas com a data original da compra: `08/03 11/12`, `15/05 08/10`, `19/11 02/03`
- múltiplos cartões na mesma fatura: `7014` e `7239`

Hoje a lógica tem 2 fragilidades:
1. o parser pede para a IA devolver a `date` já em `YYYY-MM-DD`
2. a importação salva `competence_date: r.date`

Isso faz a IA “adivinhar” cedo demais o ano/mês da linha, e depois o app trata essa data como definitiva. Para parcelas antigas, isso empurra o lançamento para 2025 ou troca o mês/dia.

## Como esta fatura deveria ser lida

Dados visíveis no PDF:
- vencimento: `15/01/2026`
- fechamento: compras realizadas até `08/01`

Leitura correta dos exemplos:
- `23/12 BURITI SHOP` → compra do ciclo atual: `2025-12-23`
- `01/01 WAHIB FARUK` → compra do ciclo atual: `2026-01-01`
- `08/03 SPAY *POLIMPORT 11/12` → compra original `2025-03-08`, mas a parcela pertence à fatura de jan/2026
- `15/05 IBERIA 08/10` → compra original `2025-05-15`, mas a parcela pertence à fatura de jan/2026

Ou seja: para cartão, precisamos separar:
- data original impressa na linha
- data/ciclo em que a parcela entra na fatura atual
- vencimento da fatura

## Plano de correção

### 1. Parar de confiar na IA para gerar a data final
No `supabase/functions/parse-bank-statement/index.ts`:
- mudar o parser para extrair:
  - `raw_statement_date` exatamente como aparece no PDF (`DD/MM`)
  - `statement_due_date`
  - `statement_close_date`
  - `card_digits`
  - info de parcela
- reforçar no prompt que a fatura usa `DD/MM`, nunca `MM/DD`
- pedir para a IA não converter sozinha datas ambíguas de parcela em data final contábil

### 2. Resolver ano e ciclo no código
No `src/components/lancamentos/ImportStatementModal.tsx`:
- criar uma normalização determinística da data usando `statement_close_date`
- regra:
```text
candidate = raw_date com ano do fechamento
se candidate > statement_close_date:
  candidate = candidate - 1 ano
```

Exemplo com fechamento `2026-01-08`:
```text
23/12 -> 2025-12-23
01/01 -> 2026-01-01
08/03 -> 2025-03-08
```

### 3. Tratar parcelas antigas como itens da fatura atual
Para importação de cartão:
- `payment_date` continua sendo o vencimento da fatura (`statement_due_date`)
- se a linha for parcelada e a data original cair fora do ciclo atual, ela não pode continuar comandando a competência
- nesses casos:
  - `competence_date` = `statement_close_date` (ou outro marcador do ciclo atual)
  - a data original da compra precisa ser preservada separadamente

### 4. Preservar a data original da compra
Recomendação: adicionar uma coluna nova em `transactions`, por exemplo:
- `purchase_date_original date null`

Assim a Eva pode guardar:
- Data original da compra: `08/03/2025`
- Competência da fatura: `08/01/2026` (ciclo atual)
- Vencimento/pagamento da fatura: `15/01/2026`

Isso deixa o comportamento mais “bancário” e evita perder informação histórica.

### 5. Melhorar a conferência antes de importar
No preview da importação:
- mostrar lado a lado:
  - data original do PDF
  - data final de competência
  - vencimento da fatura
  - parcela
  - cartão detectado
- se alguma linha ficar fora do ciclo sem ser parcelada, marcar alerta para revisão

### 6. Ajustar as telas que exibem a data
Atualizar:
- `src/components/contas/CreditCardBillPaymentModal.tsx`
- `src/components/lancamentos/TransactionDetailModal.tsx`

Para exibir, quando existir:
- data original da compra
- competência da fatura
- vencimento da fatura

Assim o cálculo da fatura fica correto e a auditoria continua clara.

## Detalhes técnicos

### Arquivos afetados
- `supabase/functions/parse-bank-statement/index.ts`
- `src/components/lancamentos/ImportStatementModal.tsx`
- `src/components/contas/CreditCardBillPaymentModal.tsx`
- `src/components/lancamentos/TransactionDetailModal.tsx`
- migration SQL para adicionar `purchase_date_original` na tabela `transactions`

### Resultado esperado com esta fatura
- compras normais de dezembro/janeiro entram com datas reais corretas
- parcelas antigas não “caem em 2025” na competência da fatura de jan/2026
- a origem da compra continua preservada
- os cartões `7014` e `7239` continuam separados corretamente
- o erro deixa de depender da interpretação livre da IA, porque a data passa a ser resolvida por regra determinística
