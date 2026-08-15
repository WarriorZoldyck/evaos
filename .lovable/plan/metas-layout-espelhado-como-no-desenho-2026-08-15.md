# Metas — layout espelhado como no desenho

## O que está quebrado hoje

- As duas colunas só ficam lado a lado a partir de 1024px; na largura atual (~880px) tudo empilha e vira uma pilha vertical — por isso "quebrou".
- O painel de ajuste da categoria (card verde) aparece mesmo com o bloco fechado, e o cabeçalho "Simulação" ocupa a linha do Saldo.
- Os cards "Ganho total" e "Meta de economia" estão numa faixa no meio da página, empurrando o resto.

## Como deve ficar

```text
Planejamento fin.          Meta mensal              Resumo (lateral)
[ Saldo total ]            (vazio — sem saldo)      [ Ganho total  mês/ano ]
[ Média entradas ]   <->   [ Média entradas meta ]  [ Meta economia mês/ano ]
   (lista real)               (painel +/- + lista)
[ Média saídas ]     <->   [ Média saídas meta ]
   (lista real)               (painel +/- + lista)
[ Capacidade mensal ]<->   [ Nova capacidade ]
[ Sobra até dez ]    <->   [ Nova sobra ]
```

1. **Espelhamento real**: a coluna esquerda continua fixa (referência). A direita repete a mesma estrutura a partir de "Média de entradas". O topo da direita fica vazio — nada de card de saldo nem de cabeçalho "Simulação".
2. **Abrir/fechar sincronizado**: clicar em "Média de entradas" (de qualquer lado) abre a lista nos dois lados e fecha o bloco de saídas nos dois; e vice-versa. Um bloco aberto por vez.
3. **Painel de ajuste só quando aberto**: o card verde de ajuste (+/−, R$ e %) aparece apenas dentro do bloco aberto, na coluna direita, junto da lista de categorias espelhada. Com tudo fechado, sobram só as comparações Capacidade x Nova capacidade e Sobra x Nova sobra.
4. **Cards de resumo na lateral**: "Ganho total" e "Meta de economia" (valor por mês e por ano) saem do meio da página e passam para uma coluna estreita à direita, empilhados, junto com o botão "Criar meta com base nisso".
5. **Ajustes para mais e para menos** em entradas e saídas continuam como estão (mês atípico: viagem sobe a saída, renda extra sobe a entrada).

## Detalhes técnicos

- `src/pages/Metas.tsx`:
  - grid principal passa a ser `md:grid-cols-[1fr_1fr_minmax(200px,240px)]` (e `md:` em vez de `lg:` nas linhas pareadas) para não empilhar em ~880px; abaixo de `md` mantém empilhado com a coluna meta logo abaixo do bloco real correspondente.
  - remover o bloco de cabeçalho "Simulação" e deixar a célula direita da primeira linha vazia; mover `GainTotalCard`/`SavingGoalCard` + botão de criar meta para a terceira coluna (sticky no topo).
  - renderizar `OverviewDetailPanel` apenas quando `openBlock` corresponder ao bloco.
- `src/components/metas/planejamento/FinancialOverview.tsx`:
  - `SimulationSummary` deixa de conter o botão/resumo de criação (vai para a coluna lateral) e passa a expor só as duas linhas de comparação.
  - ajuste de espaçamento/tipografia dos cards para caber na coluna mais estreita.
- Sem mudanças de banco, de cálculo ou fora de `/metas`.
