
## Ocultar campo de juros manual para maquininhas e usar taxas por parcela

### Problema
Quando a forma de pagamento e cartao de credito via maquininha, o campo "Taxa de juros mensal (%)" aparece desnecessariamente, pois as taxas ja estao cadastradas na maquininha. Alem disso, o card de detalhes da maquininha (MdrInfoCard) sempre usa a taxa de credito a vista (`credit_rate`), ignorando as taxas por parcela (`rates_info`).

### Solucao

**1. Ocultar campo de juros quando houver maquininha selecionada**

No `MainFormContent` dentro de `TransactionFormModal.tsx`, verificar se o metodo de pagamento e cartao e se ha um terminal selecionado (`card_terminal_id`). Se sim, esconder o campo "Taxa de juros mensal (%)".

**2. Atualizar MdrInfoCard para usar taxa por parcela**

No `MdrInfoCard.tsx`, quando o pagamento for credito parcelado, buscar a taxa correta no `rates_info` do terminal de acordo com o numero de parcelas. Se nao encontrar uma taxa especifica para aquela quantidade de parcelas, usar a `credit_rate` como fallback.

### Alteracoes tecnicas

**Arquivo: `src/components/lancamentos/MdrInfoCard.tsx`**
- Na logica de calculo do `useMemo`, quando `isCredit` e `installmentsCount >= 2`:
  - Parsear `rates_info` do terminal
  - Buscar a taxa correspondente ao numero de parcelas
  - Usar essa taxa em vez de `credit_rate`
  - Fallback para `credit_rate` se nao encontrar

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**
- No `MainFormContent`, observar `card_terminal_id` via `form.watch`
- Condicionar a exibicao do campo `interest_rate` para aparecer apenas quando NAO houver terminal selecionado (ou seja, quando nao e uma venda via maquininha)
- Quando houver terminal, o campo fica oculto e o valor de `interest_rate` permanece 0 (sem impacto no calculo de submit, pois o MDR ja e tratado separadamente)
