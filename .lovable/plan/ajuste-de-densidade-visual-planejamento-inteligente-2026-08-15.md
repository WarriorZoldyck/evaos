# Ajuste de densidade visual — Planejamento Inteligente

Em telas largas os cards esticam por toda a largura do conteúdo, deixando muito espaço vazio à direita dos valores. O ajuste é só de layout e estilo, sem mexer em cálculos ou dados.

## O que muda

- **Largura máxima da página**: o conteúdo passa a ter um limite (aprox. 1180px) centralizado, então em monitores grandes os cards param de esticar.
- **Cards mais compactos**: dentro de cada coluna, os cards de Saldo, Média de entradas, Média de saídas, Meta de entradas e Meta de saídas ganham largura máxima menor e padding um pouco menor, ficando com aparência de "bloco de métrica" e não de faixa larga.
- **Rótulo e valor na mesma linha** nos cards de métrica quando há espaço, reduzindo a altura e o vazio interno.
- **Coluna lateral um pouco mais estreita** e com espaçamento vertical menor entre os cards, mantendo o comportamento fixo (sticky).
- **Listas de categorias** com linhas levemente mais compactas para caber mais itens sem rolagem.
- Em telas médias e mobile nada empilha diferente do que já acontece hoje; o limite de largura só age acima de ~1200px.

## Detalhes técnicos

- `src/pages/Metas.tsx`: wrapper com `max-w-[1180px] mx-auto`, `gap` reduzido no grid principal e coluna lateral de `minmax(190px,230px)` para `minmax(180px,210px)`.
- `src/components/metas/planejamento/FinancialMetricCard.tsx`: padding `px-3.5 py-2.5`, label e valor em linha única com `justify-between` a partir de `sm`, valor em `text-base`.
- `src/components/metas/planejamento/FinancialOverview.tsx`: `PairedCategoryList` com linhas `py-1` e cards internos com padding menor; `SimulationSummary` e `TotalsCard` alinhados à mesma densidade.
- Nenhuma cor nova em componentes — tudo continua via tokens semânticos e `.glass-card`.
