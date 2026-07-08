Corrigir a conciliação de fatura para não puxar lançamentos que (a) não são do cartão e já estão pagos, ou (b) são de faturas anteriores já quitadas.

### 1. `src/hooks/useImportMatching.ts`
- Onda B (despesas sem `credit_card_id`): adicionar `.eq("status", "Pendente")`. Pagos sem cartão nunca devem entrar como candidatos de uma nova fatura.
- Onda A (já ligadas ao cartão): manter Pendente+Pago, mas em memória descartar candidatos `Pago` cuja `purchase_date_original` esteja fora de `[minDate, maxDate]` do extrato — são de fatura anterior.

### 2. `src/components/lancamentos/ImportStatementModal.tsx` (painel de órfãos)
- Onda B da consulta de órfãos: `.eq("status", "Pendente")`.
- Onda A: filtrar em memória removendo `status='Pago'` com `purchase_date_original` fora do escopo `[minDate, maxDate]`.

### 3. `src/lib/import/matching.test.ts`
- Novo teste: candidato com `status='Pago'` e `purchase_date_original` em maio não é sugerido para uma linha de extrato em junho.
- Novo teste: candidato sem cartão e `status='Pago'` não aparece como candidato Wave B (documenta a nova regra).

### Fora do escopo
- Não altero dados existentes no banco.
- Não mexo em Wave A para contas de débito (fluxo não-cartão continua igual).
