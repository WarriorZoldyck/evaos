

## Corrigir dados do DRE e Fluxo de Caixa

Foram identificados 3 problemas que causam divergencia entre os relatorios e os dados reais do sistema.

### Problema 1: Fluxo de Caixa truncando dados em 1000 registros

O hook `useCashFlowData` nao implementa paginacao. O Supabase limita retornos a 1000 linhas por padrao. Com mais de 1000 transacoes no banco, o relatorio pode estar incompleto.

**Solucao**: Adicionar o mesmo loop de paginacao que ja existe no `useDREData`.

### Problema 2: Transferencias entre contas inflando receitas e despesas

Transferencias internas geram 2 registros (1 receita + 1 despesa) com `transfer_id` preenchido. Ambos aparecem nos relatorios, inflando os totais de receita e despesa artificialmente.

**Solucao**: Excluir transacoes com `transfer_id IS NOT NULL` das queries do DRE e do Fluxo de Caixa.

### Problema 3: Fluxo de Caixa sem subcategory2

O Fluxo de Caixa nao busca o campo `subcategory2` no select, podendo agrupar incorretamente transacoes com 3 niveis de categoria.

**Solucao**: Adicionar `subcategory2` ao select e usar a mesma logica de `buildChain` com 3 niveis.

---

### Alteracoes por arquivo

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useCashFlowData.ts` | Adicionar paginacao, filtrar `transfer_id`, incluir `subcategory2`, usar `buildChain` com 3 niveis |
| `src/hooks/useDREData.ts` | Filtrar `transfer_id IS NULL` na query |

### Detalhes tecnicos

**`useCashFlowData.ts`** - Query com paginacao e filtro de transferencia:
```typescript
let q = supabase
  .from("transactions")
  .select("id, amount, type, status, category, subcategory, subcategory2, bank_account_id, credit_card_id, transfer_id")
  .gte(dateField, startStr)
  .lte(dateField, endStr)
  .is("transfer_id", null); // excluir transferencias

// Paginacao
const allData: any[] = [];
let page = 0;
const pageSize = 1000;
while (true) {
  const { data } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
  if (!data || data.length === 0) break;
  allData.push(...data);
  if (data.length < pageSize) break;
  page++;
}
```

**`useDREData.ts`** - Adicionar filtro de transferencia:
```typescript
let q = supabase
  .from("transactions")
  .select("id, amount, type, category, subcategory, subcategory2, competence_date, bank_account_id, credit_card_id, transfer_id")
  .gte("competence_date", startStr)
  .lte("competence_date", endStr)
  .is("transfer_id", null); // excluir transferencias
```

**`useCashFlowData.ts`** - Substituir `resolveChain` por `buildChain` com 3 niveis (mesma logica do DRE), usando `category`, `subcategory` e `subcategory2`.

Estas correcoes se aplicam a todos os usuarios automaticamente pois sao mudancas no frontend.
