## Causa raiz (investigada no banco do usuário)

A fatura subiu de **R$ 10.865,52** para **R$ 12.257,79** porque a importação criou **lançamentos duplicados** ao invés de vincular aos já existentes. Diferença ≈ **R$ 1.392,27**.

A conciliação falhou por **dois bugs estruturais** no algoritmo (`src/lib/import/matching.ts`):

### Bug 1 — Janela de data errada para cartão de crédito
O matching compara `statement.date` (data da **compra**, ex.: 18/abr) contra `transaction.payment_date`. Para cartão de crédito, `payment_date` é sempre a **data de vencimento da fatura** (ex.: 21/mai). A diferença passa de 30 dias → nunca cai na janela de 7 dias → **nenhum** lançamento já cadastrado como Pendente é encontrado.

Evidência: o usuário tinha dezenas de Pendentes no MASTERCARD BLACK com `payment_date = 2026-05-21` (Almoço Aromas, Caldos Da Lu, Drogasil 2/2 R$278,69, Bisturi elétrico, Aramis, AirBNB, parcelas, etc.) — todos deveriam ter dado match e foram recriados.

### Bug 2 — Sem deduplicação dentro do próprio extrato
O extrato traz a mesma compra com pequenas variações de espaço (ex.: "CARNE DE SOL 1008 ALIMENTAÇÃO .GOIANIA" vs "CARNE DE SOL 1008 ALIMENTAÇÃO.GOIANIA", mesmo valor R$5, mesma data) e ambas foram inseridas. Idem várias linhas "DL*UberRides".

### Bug 3 — Tolerância de centavo
Drogasil 2/2 existia como R$ 278,69 e veio no extrato como R$ 278,70 → não casou.

---

## Plano

### 1. Corrigir matching para cartão de crédito (`src/lib/import/matching.ts` + `useImportMatching.ts`)
- Adicionar campo opcional `competence_date` em `CandidateTx`.
- Quando o destino é cartão de crédito, comparar `line.date` contra `candidate.competence_date` (data da compra) — não `payment_date`.
- Incluir `competence_date` no `SELECT` do `useImportMatching` e ampliar janela para **15 dias** em cartão (lançamentos manuais costumam ter a data aproximada).
- Aumentar tolerância de valor para **R$ 0,02** (cobre arredondamento de centavo).

### 2. Deduplicação intra-extrato (`ImportStatementModal.tsx`)
Antes de exibir as linhas no `ReconcileStep`, agrupar por `(date, amount, normalize(description))` colapsando variações de espaço/pontuação. Linhas idênticas viram uma só com badge `×N` (já existe a estrutura visual). Isso elimina o caso "CARNE DE SOL" duplicado e os Ubers repetidos.

### 3. Auto-match agressivo para cartão (mesmo destino + mesmo valor + janela)
Quando há **exatamente um** candidato Pendente no mesmo cartão com mesmo valor dentro da janela e nenhuma outra linha do extrato concorre por ele, marcar automaticamente como `vincular` por padrão (em vez de "criar novo"), mesmo com descrição diferente. Usuário ainda pode trocar para "criar novo".

### 4. Mensagem de revisão final
No último passo antes de confirmar, mostrar resumo:
> "Vamos criar **X** novos lançamentos, vincular **Y** existentes e ignorar **Z**. Total da fatura após import: **R$ ___**."
Para o usuário ver se o total bate com o extrato antes de gravar.

### 5. Limpeza dos dados do usuário `espclin@hotmail.com`
Script único (service role) para a fatura MASTERCARD BLACK / mai-2026:
- Identificar pares de duplicatas criados em `2026-06-21 20:48` cuja `(amount, normalize(description), payment_date)` colide com um lançamento mais antigo no mesmo cartão.
- Para cada par: **manter** o mais antigo (com categoria/descrição customizada do usuário) e **deletar** a duplicata recém-importada.
- Tratar separadamente o caso "CARNE DE SOL" (deletar 1 das 2) e remover a linha esdrúxula `DROGASIL ... R$ 0,01`.
- Reportar lista de IDs removidos para conferência antes de executar.

### 6. Validação
- Adicionar testes em `src/lib/import/matching.test.ts` cobrindo: cartão de crédito com `competence_date`, tolerância 0,02, dedup de descrição com espaços extras.
- Conferir total da fatura mai-2026 pós-limpeza == R$ 10.865,52.

---

## Arquivos afetados
- `src/lib/import/matching.ts` — janela por tipo de destino, tolerância, uso de `competence_date`.
- `src/lib/import/matching.test.ts` — novos testes.
- `src/hooks/useImportMatching.ts` — SELECT inclui `competence_date`; passar flag de cartão.
- `src/components/lancamentos/ImportStatementModal.tsx` — dedup intra-extrato + resumo final.
- `src/components/lancamentos/import/ReconcileStep.tsx` — exibir auto-match em cartão.
- Script SQL pontual (service role) — limpeza da conta do usuário.

Sem alterações de schema ou RLS.