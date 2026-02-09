

## Melhorias na Pagina de Lancamentos

Quatro ajustes conforme solicitado:

---

### 1. Remover agrupamento por conta - Exibir tudo em lista plana

Atualmente os lancamentos sao agrupados em grupos colapsaveis por conta bancaria/cartao/carteira. Como ja existem filtros de data, o ideal e mostrar todos os lancamentos em uma lista plana, ordenados por data.

**Arquivo:** `src/components/lancamentos/TransactionTable.tsx`

- Remover toda a logica de `groups` (useMemo que agrupa por conta)
- Remover o componente `AccountGroup` (Collapsible)
- Renderizar cada transacao diretamente em uma lista simples com divisores
- Adicionar o nome da conta/cartao como informacao na linha (texto pequeno ao lado da categoria)

### 2. Mostrar o "contexto" (contact_name) nos lancamentos

O campo `contact_name` ja existe na tabela `transactions` e ja e exibido na `TransactionRow`, porem so aparece se preenchido. Vou garantir que tambem exiba o nome do fornecedor ou cliente quando `contact_name` estiver vazio, buscando pelo `supplier_id` ou `client_id`.

**Arquivo:** `src/components/lancamentos/TransactionTable.tsx`

- Receber `suppliers` e `clients` como props
- Na `TransactionRow`, se `contact_name` estiver vazio, buscar o nome pelo `supplier_id` ou `client_id`
- Exibir o nome do contato/fornecedor/cliente abaixo da categoria

**Arquivo:** `src/pages/Lancamentos.tsx`

- Passar `suppliers` e `clients` como props para `TransactionTable`

### 3. Mascara de valor (R$) no modal de criacao

Atualmente o campo de valor e um `<Input type="number">` sem formatacao. Vou trocar por um input com mascara de moeda brasileira (R$ 1.234,56).

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx`

- Criar uma funcao helper `formatCurrencyInput` que formata o valor digitado como moeda BR
- Trocar o `<Input type="number">` do campo `amount` por um input de texto com mascara
- Ao digitar, o usuario ve "1.234,56" e o valor e convertido para numero ao submeter
- Aplicar nos dois formularios (principal e transferencia)

### 4. Paginacao exibindo todas as transacoes (nao 3 em 3)

O PAGE_SIZE atual e 20, que e adequado. O problema visual de "3 em 3" vem do agrupamento colapsavel - ao remover o agrupamento (item 1), todas as 20 transacoes da pagina aparecerao de uma vez.

---

### Resumo dos arquivos

| Arquivo | Mudanca |
|---|---|
| `src/components/lancamentos/TransactionTable.tsx` | Remover agrupamento, lista plana, exibir conta na linha, mostrar contato/fornecedor/cliente |
| `src/components/lancamentos/TransactionFormModal.tsx` | Mascara de moeda no campo valor |
| `src/pages/Lancamentos.tsx` | Passar suppliers e clients para TransactionTable |

