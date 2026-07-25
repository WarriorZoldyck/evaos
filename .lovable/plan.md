
## Causa

Em `src/components/lancamentos/PaymentMethodFields.tsx` (linhas 66-82), sempre que um cartão de crédito está selecionado, um `useEffect` recalcula `payment_date` a partir de `hoje` + `closing_day`/`due_day`:

```ts
const todayISO = ...; // hoje
const dueISO = getCreditCardDueDate(todayISO, closing_day, due_day);
form.setValue("payment_date", new Date(dueISO + "T12:00:00"));
```

Quando o usuário abre "Editar" em Análises EVA para uma pendência com cartão vinculado, o `form.reset` do `TransactionFormModal` popula `credit_card_id` com o valor original — isso dispara o effect e sobrescreve `payment_date` (ex.: pendência de 13/07 vira 21/08, próximo vencimento a partir de hoje). O `paymentDateManuallyEdited` do modal-pai não protege esse effect porque ele mora em outro componente.

## Correção

Evitar que o effect rode na hidratação do formulário. Só recalcular `payment_date` quando o usuário **trocar** o cartão de crédito dentro do modal aberto, não quando o cartão já vem preenchido do registro que está sendo editado.

Alterar apenas `PaymentMethodFields.tsx`:

- Adicionar um `useRef` (`hydratedCardIdRef`) que guarda o valor inicial de `credit_card_id` na primeira renderização do componente com um cartão selecionado.
- No effect existente, retornar cedo se `selectedCreditCardId === hydratedCardIdRef.current` (mesma seleção que veio do `reset`) — assim a data original é preservada.
- Se o usuário limpar e escolher outro cartão depois, o effect roda normalmente e recalcula a data para a fatura desse novo cartão.
- Também considerar `competence_date` como base do cálculo (em vez de `today`) para novas seleções, garantindo coerência com a compra que está sendo editada. Fallback para hoje quando não houver `competence_date`.

## Fora de escopo

- Não mexer em `TransactionFormModal.tsx`, `AnalisesEva.tsx`, nem no schema/serviços.
- Não alterar o comportamento de "Novo Lançamento" (quando não há cartão inicial, o effect roda como hoje).

## Validação

- Abrir "Editar" em uma pendência da Análises EVA com cartão de crédito: `Data de Pagamento` deve permanecer igual à do registro (ex.: 13/07 → 21/07, tal como no cartão exibido antes de clicar).
- Em "Novo Lançamento", selecionar um cartão de crédito ainda preenche a data de vencimento automaticamente com base na competência.
- Trocar o cartão no meio da edição recalcula a data (fluxo intencional).
