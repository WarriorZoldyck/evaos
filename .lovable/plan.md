

# Agrupamento Hierárquico de Cartões na Listagem de Lançamentos

## O que muda

Hoje, cada cartão de crédito aparece como um grupo independente na tabela. A ideia é criar uma **hierarquia de 2 níveis** (igual à árvore de categorias):

```text
┌─────────────────────────────────────────────────────┐
│ 💳 VISA Azul (Principal)         - R$ 20.739,08    │
│    Total da fatura (todos os cartões)               │
├─────────────────────────────────────────────────────┤
│   ▸ VISA Azul (7014)       92 tx  - R$ 15.200,00   │
│   ▸ Virtual Maria (5178)   13 tx  - R$ 3.100,00    │
│   ▸ Virtual João (7239)     7 tx  - R$ 1.800,00    │
│   ▸ Virtual Ana (8021)      3 tx  - R$   639,08    │
├─────────────────────────────────────────────────────┤
│   (ao expandir um sub-cartão, mostra os lançamentos)│
└─────────────────────────────────────────────────────┘
```

- **Nível 1 (Cartão Principal)**: mostra o valor total somado de TODOS os cartões filhos + dele mesmo. Clique expande para ver os sub-cartões.
- **Nível 2 (Sub-cartão)**: mostra o subtotal daquele cartão e a quantidade de lançamentos. Clique expande para ver as transações individuais.
- Cartões sem filhos continuam com o comportamento atual (grupo simples).

## Como implementar

### Arquivo: `src/components/lancamentos/TransactionTable.tsx`

1. **Alterar o `useMemo` de `renderItems`** para detectar hierarquia pai/filho:
   - Receber `creditCards` com `parent_card_id` (já disponível via `useTransactions`)
   - Agrupar transações de cartões filhos sob o cartão pai
   - Criar um novo tipo de item `cardHierarchy` com sub-grupos

2. **Criar componente `CardHierarchyGroup`**:
   - Header do cartão pai com total consolidado e badge de quantidade total
   - Ao expandir: lista de sub-cartões (cada um com seu header + subtotal)
   - Ao expandir sub-cartão: lista de transações individuais (como já funciona)

3. **Atualizar interface de `creditCards` prop** para incluir `parent_card_id`:
   ```typescript
   creditCards: { id: string; name: string; parent_card_id?: string | null }[];
   ```

4. **Manter compatibilidade**: cartões sem `parent_card_id` e sem filhos continuam como `cardGroup` simples.

### Arquivo: `src/pages/Lancamentos.tsx`

5. **Passar `parent_card_id`** na prop `creditCards` do `TransactionTable` (já vem do hook, só precisa incluir na tipagem).

### Arquivo: `src/hooks/useTransactions.ts`

6. Já retorna `parent_card_id` nos creditCards — apenas garantir que o tipo exportado inclui o campo na interface usada pelo componente.

## Lógica de agrupamento

```text
Para cada transação com credit_card_id:
  1. Se o cartão tem parent_card_id → agrupa sob o pai
  2. Se o cartão É pai (tem filhos) → agrupa como pai
  3. Se o cartão é standalone → comportamento atual

Resultado: Map<parentCardId, { parentTxns, childGroups: Map<childId, txns[]> }>
```

## Detalhes técnicos

- O estado `expandedCards` passa a ter 2 níveis: `expanded-parent-{id}` e `expanded-child-{id}`
- Seleção em massa continua funcionando: checkbox no pai seleciona TODOS (dele + filhos)
- Botão "Pagar Fatura" no header do pai liquida tudo

