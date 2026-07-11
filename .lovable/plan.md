## Ajuste: remover legendas redundantes dos gráficos de rosca

### O que será feito
No card "Categorias — Receitas e Despesas" (`CategoryBreakdownCard`), remover a listagem de categorias que aparece dentro de cada gráfico de rosca. O grid de detalhes à direita (`CategoryDetailGrid`) já exibe as categorias com ícone, valor, percentual, variação e sparkline, então a legenda dentro do donut é redundante.

### Mudanças técnicas
1. **`src/components/dashboard/CategoryBreakdownCard.tsx`**
   - Remover o bloco de legenda de categorias (ícone + nome + % + valor) dentro do componente `Donut`.
   - Ajustar o layout interno do `Donut` para o gráfico ocupar toda a largura disponível, sem a coluna de legenda.
   - Manter o tooltip ao passar o mouse sobre as fatias e o clique no donut para filtrar lançamentos.
   - Manter o título e o total acima de cada rosca.

### Resultado esperado
- Apenas os dois donuts (Receitas e Despesas) aparecem na coluna da esquerda.
- O grid detalhado continua à direita com todas as categorias, toggle Receitas/Despesas e demais UX já implementados.
- Visual mais limpo, sem informação duplicada.