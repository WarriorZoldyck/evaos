## Mudanças no Dashboard

### 1. Remover "Projeção de Saldo"
- Em `src/pages/Dashboard.tsx`: remover o bloco `<BalanceProjectionChart ... />` e o import correspondente.
- Manter o hook `getProjectionData` intacto no `useDashboardData` (não mexer em lógica), apenas deixar de consumi-lo no Dashboard.
- O arquivo `BalanceProjectionChart.tsx` fica no projeto (não usado), sem deletar para evitar quebras.

### 2. Unificar "Receitas por Categoria" e "Despesas por Categoria" em um único card
Substituir o `CategorySummaryCharts` (que hoje renderiza dois cards lado a lado) por um único card com duas seções empilhadas (receita em cima, despesa embaixo), no estilo da referência:

- Criar `src/components/dashboard/CategoryBreakdownCard.tsx`:
  - Um `Card` único, título "Categorias — Receitas e Despesas".
  - Duas subseções verticais: **Receitas** e **Despesas**.
  - Cada subseção lista as categorias como linhas (não donut), com:
    - Ícone colorido à esquerda (usando `getCategoryIcon` de `dashboardInsights.ts`, mesma lógica do `CategoryDetailGrid`).
    - Nome da categoria + % do total ao lado.
    - Valor formatado em BRL à direita.
    - Barra de progresso fina (proporcional ao % do total da seção) usando a cor `fill` da categoria.
  - Clique na linha navega para `/lancamentos?category=...&type=receita|despesa` (mesma navegação atual).
  - Estado de loading com `Skeleton`, estado vazio com mensagem.
- Em `Dashboard.tsx`: substituir `<CategorySummaryCharts ... />` por `<CategoryBreakdownCard revenueCategories={...} expenseCategories={...} totalReceitas={summary.entradas} totalDespesas={summary.saidas} loading={loading} />`.
- O `CategoryDetailGrid` (grid de 6 cards com sparkline, abaixo) **permanece** — não é afetado.

### Detalhes técnicos
- Nenhum hook ou cálculo de dados é alterado.
- Sem mudanças em backend, schema ou edge functions.
- Tokens semânticos do design system (sem cores hardcoded).
- Arquivos tocados:
  - `src/pages/Dashboard.tsx` (remover import + bloco da projeção; trocar componente de categorias)
  - `src/components/dashboard/CategoryBreakdownCard.tsx` (novo)
