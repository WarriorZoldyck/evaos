

## Correções no "Próximos Lançamentos" do Dashboard

### Problemas Identificados no Vídeo

**1. Categorias mostrando UUID para lançamentos feitos hoje**
O `useMemo` de `upcomingTransactions` (linha 385) não inclui `resolveCategoryName` nas dependências. Quando as categorias carregam depois das transações, o memo não recalcula e o UUID bruto permanece visível.

**2. Transações recorrentes (legadas) sem botão de Liquidar funcional**
As ocorrências recorrentes são virtuais -- possuem IDs sintéticos como `rec_xxx_2026-02-18`. O botão "Liquidar" aparece, mas o `LiquidateModal` tenta atualizar um registro inexistente no banco. O usuário precisa poder liquidar (materializando a ocorrência) ou excluir essas recorrentes.

**3. Transações recorrentes sem botão de Excluir**
O botão de exclusão é escondido quando `isRecurring === true` (linha 231). O usuário quer poder excluir a transação recorrente da lista (apagar o registro na tabela `recurring_transactions`).

---

### Correções Propostas

**Arquivo: `src/hooks/useDashboardData.ts`**
- Adicionar `resolveCategoryName` à lista de dependências do `useMemo` de `upcomingTransactions` (linha 385), garantindo que a resolução de nomes ocorra mesmo quando as categorias carregam após as transações.

**Arquivo: `src/components/dashboard/UpcomingTransactions.tsx`**
1. **Habilitar exclusão de recorrentes**: Mostrar o botão "Excluir" para TODAS as transações (remover o guard `!t.isRecurring`). Para transações recorrentes, a exclusão vai operar na tabela `recurring_transactions` usando o ID real extraído do ID sintético (`rec_{realId}_{date}` -> `realId`).

2. **Corrigir liquidação de recorrentes**: Quando o usuário clicar "Liquidar" em uma recorrente, primeiro materializar a ocorrência como uma transação real na tabela `transactions` (INSERT com os dados da ocorrência), e então abrir o `LiquidateModal` com o ID real recém-criado.

**Arquivo: `src/pages/Dashboard.tsx`**
- Nenhuma alteração necessária -- o callback `onLiquidated` já faz refetch dos dados.

### Detalhes Técnicos

**Exclusão de recorrentes:**
```text
ID sintético: "rec_UUID-REAL_2026-02-18"
Extração: id.replace("rec_", "").replace(/_\d{4}-\d{2}-\d{2}$/, "")
DELETE FROM recurring_transactions WHERE id = realId
```

**Materialização para liquidação:**
```text
1. Extrair dados da ocorrência virtual
2. INSERT INTO transactions (description, amount, type, status, payment_date, category, ...)
3. Obter o ID real do registro inserido
4. Abrir LiquidateModal com esse ID
```

**Dependência do useMemo:**
```text
Atual:  [transactions, recurringOccurrences, startStr, endStr]
Corrigido: [transactions, recurringOccurrences, startStr, endStr, resolveCategoryName]
```

### Impacto
- Zero alteração no schema do banco de dados
- Categorias sempre exibidas como nomes legíveis
- Recorrentes podem ser excluídas permanentemente
- Recorrentes podem ser liquidadas (materializadas como transação real)
