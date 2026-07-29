## Objetivo
Alinhar os cálculos da sidebar de Metas (Saldo, Média de entradas/mês, Média de saídas/mês, categorias) para usar exatamente a mesma fonte da tabela **Fluxo de Caixa por Categoria — 2026**, para que os valores batam com a primeira linha de RECEITAS e a de DESPESAS.

## Diagnóstico
Hoje `useMetasSidebarStats` faz sua própria consulta em `transactions`, com filtros diferentes do `useCashFlowMonthly`:
- Não usa `applyCompanyFilter` (ignora `viewAll` / `selectedCompanyIds` / `personalSelected`)
- Não passa por `splitContextNeutralTransfers` (regra oficial de transferências)
- Resolve categorias por lookup direto (sem colapso case-insensitive)

Resultado: valores da sidebar divergem da tabela do Fluxo de Caixa que está ao lado.

## Mudança
Substituir a coleta própria pelo mesmo hook do Fluxo de Caixa.

**`src/hooks/useMetasSidebarStats.ts`**
1. Consumir `useCashFlowMonthly("caixa", { year: anoAtual, granularity: "monthly" })` para receitas e despesas.
2. Derivar:
   - `totalIncomeYear = sum(monthlyRevenueTotals)`
   - `totalSpentYear  = sum(monthlyExpenseTotals)`
   - `avgIncomeMonth  = totalIncomeYear / monthsElapsed`
   - `avgSpentMonth   = totalSpentYear  / monthsElapsed`
3. `incomeCategories` / `expenseCategories`: mapear a partir de `revenueRows` / `expenseRows` (nível raiz), `total = soma dos 12 meses / monthsElapsed`, ordenado desc.
4. Manter Saldo total como está hoje (`initial_balance` + `get_accounts_paid_delta`) — não vem do fluxo.
5. Manter `leftover` com a fórmula atual, agora usando as médias alinhadas.

Nenhuma outra tela é afetada — apenas o hook. A UI de Metas continua igual.
