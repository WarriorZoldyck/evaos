# Plano: coluna "Conta" nas modais Entradas/Saídas

## Alteração
Adicionar a coluna **Conta** logo antes das demais colunas de contexto na tabela do `EntradasSaidasDetailModal` (usado tanto para Entradas quanto para Saídas).

## Detalhes

### `src/components/dashboard/EntradasSaidasDetailModal.tsx`
- Novos props opcionais:
  - `bankAccounts?: { id: string; name: string }[]`
  - `wallets?: { id: string; name: string }[]`
  - `creditCards?: { id: string; name: string }[]`
- Função `resolveAccount(t)` que retorna:
  - Nome do `bank_account_id`, `wallet_id` ou `credit_card_id` (com sufixo "· Cartão" para deixar claro), nessa ordem de prioridade.
  - Fallback: `—`.
- Nova coluna **Conta** entre "Contato" e "Descrição":
  - Header: `<th>Conta</th>`
  - Célula: `resolveAccount(l.first)` com `truncate max-w-[160px]` e cor `text-muted-foreground`.
  - Visível em md+ (`hidden md:table-cell`) para não estourar em telas pequenas.
- Adicionar `conta` também na exportação CSV (coluna extra após `contato`).

### `src/pages/Dashboard.tsx`
- Passar `bankAccounts`, `wallets`, `creditCards` (já disponíveis via `useAccounts()`) para as duas instâncias do modal (Entradas e Saídas).

## Fora de escopo
- Filtro por conta dentro do modal (só exibição/CSV).
- Alterar `FaturamentoDetailModal` (usuário pediu apenas Entradas e Saídas).
