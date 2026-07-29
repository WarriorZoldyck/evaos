## Diagnóstico

Os cards principais (Média entradas / Média saídas) já usam a fórmula que você quer: `soma do ano (transações Pago, sem transferências) ÷ número do mês atual`.

Ex.: despesas 2026 = ~R$ 249.304 ÷ 7 (julho) = R$ 35.614,87 ✔

O problema está no accordion de categorias: os valores exibidos (`Honorários R$ 8.755,55`, `Depósitos diversos R$ 2.335,65`) são o **total acumulado do ano**, não a média. Por isso não "bate" com o card acima — o card divide por 7, a lista não divide.

## Correção

Em `src/hooks/useMetasSidebarStats.ts`, ao montar `incomeCategories` e `expenseCategories`, dividir cada `total` por `monthsElapsed` antes de retornar. Assim cada categoria vira a média mensal daquela linha, coerente com o card pai.

- `Honorários`: 8.755,55 / 7 = R$ 1.250,79 / mês
- `Depósitos diversos`: 2.335,65 / 7 = R$ 333,66 / mês
- Soma das médias de categorias = média do card (a menos de arredondamento).

Também ajustar o rótulo da barra de progresso: percentual continua sendo `categoria / soma_do_grupo` (não muda), mas o label do valor passa a mostrar a média/mês.

## Arquivos

- `src/hooks/useMetasSidebarStats.ts` — dividir `incomeMap`/`expenseMap` por `monthsElapsed` na conversão para `CategoryBreakdown[]`; manter `topCategories` (ActionPlanDialog) como está ou também em média — confirmar comportamento desejado no ActionPlan (proponho manter também em média para consistência).
- `src/components/metas/MetasSidebar.tsx` — pequeno ajuste opcional no sufixo "/ mês" nas linhas de categoria para deixar claro que é média.

Nada muda na fórmula dos cards principais nem na "Sobra estimada". Só uniformiza as categorias com a mesma métrica.
