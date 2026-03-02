

# Correções: Filtro de Categoria + Fatura do Cartão de Crédito

## Problema 1: Filtro de Categoria mostra menos lançamentos

**Causa raiz:** O campo `category` na tabela `transactions` armazena dados mistos — registros antigos usam **nomes de texto** (ex: "Alimentação") e registros novos usam **UUIDs** (ex: "9efd594b-..."). O filtro faz `.eq("category", categoryId)` usando sempre o UUID do dropdown, então só encontra os registros novos que salvaram UUID. Registros com nome de texto são invisíveis ao filtro.

Além disso, o filtro não inclui subcategorias — ao filtrar por uma categoria pai, lançamentos que estão em subcategorias filhas não aparecem.

**Correção:**
1. Em `useTransactions.ts` (linha 223-225): substituir o `.eq("category", filters.categoryId)` por uma lógica que:
   - Busca o nome da categoria selecionada
   - Coleta os IDs das subcategorias filhas
   - Usa `.or()` para filtrar por UUID **ou** nome da categoria pai, **incluindo** todas as subcategorias (por UUID e nome)
2. Isso garante que registros antigos (nome) e novos (UUID) sejam capturados, e que subcategorias sejam incluídas

## Problema 2: Fatura do Cartão de Crédito

**Causa raiz:** O cálculo do `billTotal` (linha 122-125 de `CreditCardBillPaymentModal.tsx`) soma todos os `amount` sem considerar o tipo da transação:
```typescript
billTransactions.reduce((sum, t) => sum + t.amount, 0)
```

Transações de `receita` no cartão (estornos, créditos) deveriam **subtrair** do total da fatura, mas são **somadas**. Isso faz o total da fatura aparecer maior que o correto.

**Correção:**
1. Em `CreditCardBillPaymentModal.tsx`: alterar o cálculo de `billTotal` para subtrair `amount` quando `type === "receita"` e somar quando `type === "despesa"`

## Detalhes Técnicos

### Filtro de categoria (useTransactions.ts)

```typescript
// Antes: só busca por UUID exato
if (filters.categoryId) {
  query = query.eq("category", filters.categoryId);
}

// Depois: busca por UUID + nome + subcategorias
if (filters.categoryId) {
  const selectedCat = categories.find(c => c.id === filters.categoryId);
  const childIds = categories.filter(c => c.parent_id === filters.categoryId).map(c => c.id);
  const allIds = [filters.categoryId, ...childIds];
  const allNames = [selectedCat?.name, ...categories.filter(c => childIds.includes(c.id)).map(c => c.name)].filter(Boolean);
  // Build OR filter matching both UUIDs and text names
  const conditions = allIds.map(id => `category.eq.${id}`);
  allNames.forEach(name => conditions.push(`category.eq.${name}`));
  query = query.or(conditions.join(","));
}
```

### Bill total (CreditCardBillPaymentModal.tsx)

```typescript
// Despesa soma, receita subtrai
const billTotal = billTransactions.reduce(
  (sum, t) => sum + (t.type === "receita" ? -t.amount : t.amount), 0
);
```

### Arquivos alterados
- `src/hooks/useTransactions.ts` — filtro de categoria com suporte a nomes + subcategorias
- `src/components/contas/CreditCardBillPaymentModal.tsx` — cálculo correto do total da fatura

