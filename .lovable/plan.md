## Objetivo

Blindar o cálculo de `payment_date` para Cartão de Crédito (especialmente para séries de parcelas) em todos os pontos do código, evitando que se repita o bug que jogou a parcela 4 de 5 séries para 21/03.

## Mudanças

### 1) Util compartilhado (frontend)

Criar `src/lib/creditCardDueDate.ts` com duas funções puras (sem dependência de date-fns, datas locais sem timezone):

- `getCreditCardDueDate(competenceISO: string, closingDay: number, dueDay: number): string` — retorna `YYYY-MM-DD` da fatura em que a competência cai.
- `getInstallmentDueDate(competenceISO: string, closingDay: number, dueDay: number, installmentNumber: number): string` — soma `(installmentNumber - 1)` meses na competência antes de calcular o vencimento.

Regra aplicada:

```text
billMonth = compDay >= closing_day ? compMonth + 1 : compMonth
dueMonth  = due_day < closing_day  ? billMonth + 1 : billMonth
payment   = (billYear ajustado, dueMonth, due_day)
```

### 2) Util compartilhado (edge functions)

Criar `supabase/functions/_shared/creditCardDueDate.ts` espelhando o util acima (Deno). Os dois arquivos têm o mesmo comportamento e são pequenos (~30 linhas).

### 3) Aplicar nos pontos críticos

- `supabase/functions/whatsapp-webhook/index.ts` (~2 lugares: bloco de "choose_account" linhas 908-928 e o bloco de installments linhas 934-984) → trocar o cálculo inline pelo util.
- `supabase/functions/eva-chat/index.ts` linhas 531-551 e o `map` de installments 581-609 → usar `getInstallmentDueDate` para sobrescrever `detail.due_date` quando há cartão (a IA pode mandar a mesma data para todas as parcelas).
- `src/components/lancamentos/PaymentMethodFields.tsx` linha 67-98 → trocar o cálculo inline pelo util do frontend.
- `src/components/lancamentos/TransactionFormModal.tsx` linhas 696-697 (geração de payment_date das parcelas) → quando o método é Cartão de Crédito, usar `getInstallmentDueDate(competence, closing, due, idx+1)` em vez de `addMonths(data.payment_date, idx)`. Mantém comportamento para outras formas de pagamento.

### 4) Guard rail defensivo

No `whatsapp-webhook` e `eva-chat`, antes de inserir em `ai_pending_transactions`:

- Se `credit_card_id` ∧ `installments_total > 1` ∧ `installment_number > 1` → recalcular `payment_date` via util (ignorar valor que a IA mandou).

Isso elimina qualquer chance de parcela > 1 ficar no mesmo ciclo da parcela 1.

### 5) Sem migration nesta etapa

Os dados já foram corrigidos. Esta etapa é só código.

## Detalhes técnicos

Assinatura proposta:

```ts
export function getCreditCardDueDate(
  competenceISO: string,   // "YYYY-MM-DD"
  closingDay: number,
  dueDay: number
): string;

export function getInstallmentDueDate(
  competenceISO: string,
  closingDay: number,
  dueDay: number,
  installmentNumber: number   // 1-based
): string;
```

Implementação avança `competenceISO` em `installmentNumber - 1` meses (preservando o dia, ou clamp para fim de mês) e delega para `getCreditCardDueDate`.

## Fora do escopo

- Não tocar em lançamentos já criados.
- Não alterar a UI do modal "Pagar Fatura" (item adiado).
- Não alterar a regra de ciclo (mantém comportamento atual).
