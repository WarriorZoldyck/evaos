## Achei a causa dos R$ 25

O prompt do parser (`supabase/functions/parse-bank-statement/index.ts`, linhas 170-171) manda o Gemini **deduplicar linhas idênticas**:

```
DEDUPLICATION:
- If the SAME purchase line appears twice (same date, amount, description — possibly with subtle whitespace differences), include it ONLY ONCE.
```

Foi exatamente o que aconteceu com os 2 sorvetes de 06/06 (R$ 25 cada, mesma descrição "ItalyanSorvetes"): o modelo devolveu apenas 1. Por isso o total do extrato ficou em **R$ 8.825,02** (= 8.850,02 − 25) mesmo depois de removermos a dedup do frontend.

Fizemos a mesma correção no `ImportStatementModal` na rodada anterior — faltou fazer no parser.

## Correção

Arquivo: `supabase/functions/parse-bank-statement/index.ts`

Trocar o bloco DEDUPLICATION por uma instrução explícita de **preservar duplicatas**:

```
PRESERVE DUPLICATES:
- The bank statement is the source of truth. If the SAME purchase (same date, same amount, same description) appears N times, emit it N times. Two identical purchases on the same day are common (e.g. two ice creams for R$ 25 each at the same shop). NEVER collapse repeated lines into one.
```

Reforço complementar (mesmo arquivo, mesma system message): adicionar bullet no bloco "CRITICAL RULES" — "The count of transactions you return must match the count of visible purchase lines in the statement body."

## Escopo

- Só o prompt do parser. Nada de código de matching, UI ou dedup no cliente.
- Depois da mudança, ao reimportar a fatura de junho: o total do extrato deve bater **R$ 8.850,02**, aparecem 59 linhas (58 atuais + o 2º sorvete que faltava — se seu resumo de 58 lançamentos já contava só 1 sorvete). E os 2 sorvetes ficam visíveis para conciliar/criar.

Aguardando OK.