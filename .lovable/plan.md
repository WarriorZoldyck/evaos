
## Problemas identificados

**1. Lançamentos — valor BRUTO vem descontado o MDR ao editar**
No `TransactionFormModal.tsx` (linha ~410), o `form.reset` usa `editTransaction.amount`, que já é o valor **líquido** (após MDR) para receitas passadas por maquininha. O valor bruto real está em `editTransaction.original_amount`.

**2. Lançamentos — campos vêm em branco na 1ª abertura, precisa fechar/reabrir**
O `TransactionFormModal` permanece montado no DOM entre aberturas (mesmo com `open=false`). Quando `editTransaction` muda de `null` (novo lançamento) para uma transação existente, o `useEffect([editTransaction, open])` dispara mas os Selects (categoria, conta, forma de pagamento) já renderizaram valores stale/vazios em ciclo anterior, e o `form.reset` chega depois do primeiro paint — daí a sensação de "tudo vazio". Reabrir força um novo ciclo limpo.

**3. Análises EVA — edição não puxa tudo e não reflete**
- Mesmo bug do BRUTO: `pendingToTransaction` mapeia `item.amount` como valor da transação, ignorando `item.original_amount` quando existe (transações de cartão via terminal criadas pela EVA).
- `handlePendingUpdate` chama `updatePending.mutate` (fire-and-forget) e retorna `true` imediatamente, então o modal fecha antes do UPDATE completar; se o usuário aprovar rapidamente, aprova dados stale. Precisa aguardar a mutation via `mutateAsync`.
- O update também não está gravando `original_amount`, então uma edição de valor perde a referência do bruto original.

## Correções

### `src/components/lancamentos/TransactionFormModal.tsx`
- No bloco de reset com `editTransaction` (linha ~408): usar `editTransaction.original_amount ?? editTransaction.amount` no campo `amount` para mostrar o BRUTO quando houver MDR aplicado.
- Adicionar `key={editTransaction?.id ?? "new"}` no Dialog raiz (ou envolver o conteúdo) para forçar remontagem limpa a cada nova transação editada, eliminando o problema de "campos em branco na primeira abertura".

### `src/pages/Lancamentos.tsx`
- Ao passar `editTransaction` para o `TransactionFormModal`, garantir que o `key` prop no modal seja único por transação (parte da mudança acima).

### `src/pages/AnalisesEva.tsx`
- `pendingToTransaction`: preencher `amount` com `item.original_amount ?? item.amount` para que o modal já mostre o BRUTO.
- `handlePendingUpdate`: aguardar a mutation com `mutateAsync` antes de retornar `true`. Incluir `original_amount` no payload de update (preservando o bruto quando o valor for editado, ou limpando quando o usuário mudar completamente).

### `src/hooks/useAIPendingTransactions.ts`
- Expor `updatePendingAsync = updatePendingMutation.mutateAsync` para uso em `handlePendingUpdate`.

## Escopo e não-impacto

- Nenhuma alteração no DRE, hooks financeiros, edge functions, WhatsApp ou banco.
- Nenhuma migração de dados retroativa (o `original_amount` já está gravado corretamente hoje; só estamos corrigindo a exibição e o salvamento na edição).
- Fluxo de criação (novo lançamento) não muda.
- Aprovação de lançamentos EVA continua igual — apenas a edição prévia passa a refletir os campos completos.

## Verificação após implementação

1. Lançamentos → editar receita de cartão com MDR: campo "Valor Bruto" mostra o bruto (ex.: R$ 7.160,00), não o líquido (R$ 6.781,24). Categoria, conta e forma de pagamento aparecem preenchidas na 1ª abertura.
2. Salvar sem mudanças: valor líquido no banco permanece igual (MDR re-aplicado sobre o mesmo bruto).
3. Análises EVA → editar item pendente: todos os campos originais aparecem (categoria, contato, conta, método, notas, anexo). Salvar reflete no card e persiste após reload.
