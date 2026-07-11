## Corrigir barrinha de "Utilizado" nos cartões do Dashboard

### Diagnóstico

O `DashboardCreditCardsRow` está agregando o valor do ciclo a partir de `allTransactions`, que vem de `useDashboardData` filtrado pelo período selecionado (`payment_date BETWEEN startStr AND endStr`). Consequência:

- Ao alternar para **Fatura anterior** ou **Próxima fatura**, o mês do ciclo cai fora do período do Dashboard → total zera (screenshot: `jun/26` mostra R$ 0,00 enquanto o modal mostra R$ 8.745,37).
- Mesmo para o mês corrente, transações pendentes com `payment_date` fora da janela do Dashboard não entram.

Antes da mudança de ciclos, o cálculo usava `status === "Pendente"` sem filtrar por data, o que também não é correto (misturava faturas de meses diferentes), mas por coincidência mostrava algum valor.

### Correção

Buscar os totais por ciclo diretamente do Supabase, independente do filtro de período do Dashboard, com um único query cobrindo os três meses (anterior, atual, próximo) para todos os cartões visíveis.

- Criar hook `useCreditCardCycleTotals(cardIds: string[])` em `src/hooks/useCreditCardCycleTotals.ts`:
  - Calcula `startStr` = primeiro dia do mês anterior e `endStr` = último dia do mês seguinte (usando `date-fns`).
  - Query única: `transactions.select("credit_card_id, payment_date, type, amount").in("credit_card_id", cardIds).gte("payment_date", startStr).lte("payment_date", endStr).is("transfer_id", null).or("payment_method.is.null,payment_method.neq.Cartão de Débito")` — mesmas blindagens que o modal (`CreditCardBillPaymentModal`) usa para não incluir transferências nem débito.
  - Escopo por usuário: `.eq("user_id", effectiveUserId)`.
  - Retorna `Map<cardId, Map<'YYYY-MM', number>>` já com sinal (despesa +, receita −), além de `loading` e `refetch`.
  - Reexecuta quando `cardIds` (ordenados, join) mudar ou `effectiveUserId` mudar.

- `src/components/dashboard/DashboardCreditCardsRow.tsx`:
  - Remover a agregação local baseada em `allTransactions`.
  - Consumir o novo hook passando `creditCards.map(c => c.id)`.
  - Continuar usando `Math.max(0, total)` para o `usedAmount` exibido.
  - `allTransactions` deixa de ser usado no componente; pode remover o prop (e a passagem em `Dashboard.tsx`) ou mantê-lo por retrocompatibilidade — vou remover para não confundir.

- `src/pages/Dashboard.tsx`:
  - Remover a prop `allTransactions` da chamada de `<DashboardCreditCardsRow />` (mantém `loading`).

### Fora de escopo

- Sem alterações no modal de fatura, no `useDashboardData`, nem na lógica de ciclos/navegação já implementada.
- Sem mudanças na regra de sinal ou nas blindagens de transferência/débito (mantidas iguais às do modal, para o valor bater com o "Total da Fatura" mostrado ao clicar em **Ver / Pagar fatura**).
