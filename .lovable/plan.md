## Diagnóstico

Na tela: linha do extrato **"SALTO CORUMBA HOTE02/02" · 19/04/26 · R$ 343,75** foi cruzada com **"Compra no Salto Corumbá Hotel Camping Clube (1/2)"** em vez da (2/2).

**Por qual data o sistema cruza?** Para cartão, ele usa a **data da compra original (`purchase_date_original`)** — não a competência nem o pagamento. Isso está correto: bate exatamente com a data que aparece no extrato da fatura (19/04/26). O problema não é a data.

**O problema é o parser de parcelas** em `src/components/lancamentos/ImportStatementModal.tsx` (linhas 312-353):

1. **Regex exige separador** antes do "NN/NN":
   ```
   /[\s\-–](\d{1,2})\s*[\/\\]\s*(\d{1,2})\s*$/
   ```
   A string do extrato vem **grudada**: `"SALTO CORUMBA HOTE02/02"` — sem espaço/hífen entre `HOTE` e `02/02`. Regex não casa → `installment_number` da linha fica `null`.

2. **Só marca parcela quando há grupo de 2+ linhas no mesmo extrato** (`if (group.indices.length > 1)`). No caso a parcela 1/2 foi importada numa fatura anterior; nesta importação só a 2/2 aparece → grupo tem 1 índice → mesmo se o regex casasse, o `installment_number` não seria propagado para a linha final.

Como `line.installment_number` fica `null`, o guard estrito em `scoreCandidate` (`matching.ts:217`) não dispara e ambos os candidatos 1/2 e 2/2 empatam (mesma data de compra, mesmo valor, mesma descrição, mesmo contato). O primeiro ordenado vence — a 1/2.

## Correção

Editar `src/components/lancamentos/ImportStatementModal.tsx`:

1. **Regex mais tolerante** — aceitar `NN/NN` no final da descrição mesmo grudado a letras (ex.: `HOTE02/02`, `LOJA3/10`):
   ```ts
   const installmentRegex = /(\d{1,2})\s*[\/\\]\s*(\d{1,2})\s*$/;
   ```
   Mantém `parcRegex` para variantes "PARC 2/2".

2. **Propagar `installment_number`/`installments_total` também quando o grupo tem 1 linha** (parcelas anteriores já importadas em faturas passadas). Move a atribuição de `installment_number`/`installments_total` para dentro do `forEach` inicial (junto com `_installment_number`), independente do agrupamento. O `series_id`/`original_amount` continua sendo criado só quando `group.length > 1` (isso segue a semântica atual).

Com isso, a linha "HOTE02/02" passa a chegar em `useImportMatching` com `installment_number=2, installments_total=2`, o guard estrito em `matching.ts:217-218` descarta a (1/2) e casa corretamente na (2/2).

## O que NÃO muda

- Nenhuma mudança em `matching.ts` (o guard já existe e funciona).
- Nenhuma mudança na data usada para casar (continua `purchase_date_original` → bate com extrato).
- Sem migração de dados. Sem rollback desta importação necessário; após o fix o usuário reimporta o extrato e a linha vai casar com a (2/2).

## Validação

- Testar com "SALTO CORUMBA HOTE02/02" → deve sugerir a (2/2).
- Testar caso já coberto "PARC 2/12" e "Loja - 3/10" → seguem funcionando (regex antiga era subconjunto).
- Rodar `bunx vitest run src/lib/import/matching.test.ts`.
