# Simuladores sempre abertos em Metas

Hoje existe um único painel lateral que só aparece quando uma categoria está selecionada e desaparece ao desmarcar — por isso o layout "pula". A mudança deixa os dois simuladores (ganhos e economia) fixos na coluna do meio, sempre visíveis, e o clique na categoria apenas troca qual categoria está sendo simulada.

## Como fica

```text
[ Contexto ]   [ Simulador de ganhos   ]   [ Cofrinhos / plano ]
[ Entradas ]   [ Simulador de economia ]
[ Saídas   ]
```

- A coluna dos simuladores existe sempre (grid fixo de 3 colunas no desktop), então nada se mexe ao clicar.
- Cada simulador mantém sua própria categoria selecionada: clicar numa categoria de Entradas muda só o simulador de ganhos; clicar numa de Saídas muda só o de economia.
- Ao carregar, cada simulador já abre na maior categoria da sua lista.
- Clicar na categoria já selecionada não fecha mais o painel (sem estado "vazio"); se uma lista não tiver categorias, o simulador correspondente mostra uma mensagem curta no lugar.
- O botão de fechar (X) sai do cabeçalho do simulador, já que ele é permanente. O "Limpar" (zerar percentuais) continua.
- O alinhamento dinâmico por `offsetTop` deixa de ser necessário: os dois cards ficam empilhados no topo da coluna.

## Limite de aumento nas entradas

- O simulador de ganhos deixa de travar em 100%: o slider vai de 0% a 1000% (passo maior, ex. 10%).
- Acima de 1000% o percentual deixa de ser o comando: o usuário digita o valor alvo de faturamento no campo em reais e o percentual apenas reflete o que foi digitado (sem clamp para baixo).
- O simulador de economia continua limitado a 100% (não dá para cortar mais do que se gasta).


## Detalhes técnicos

- `src/pages/Metas.tsx`: trocar `selected: SelectedCategory | null` por dois estados (`selectedIncome`, `selectedExpense`), auto-selecionar a maior categoria de cada lista quando os dados chegam, renderizar `OverviewDetailPanel` duas vezes (income e expense) numa coluna fixa e remover `anchorTop`/`--panel-top` e a grid condicional.
- `src/components/metas/planejamento/FinancialOverview.tsx`: `onSelectCategory` passa a apenas definir a categoria (sem toggle para `null`); `CategoryList` recebe a seleção por tipo; remover o `onAnchorChange`/refs de âncora e o botão de fechar do `OverviewDetailPanel`; adicionar estado vazio quando não houver categorias.
- O total simulado de cada painel continua somando os percentuais da sua própria lista (economia total / ganho total), sem mistura entre entradas e saídas.
- Sem mudanças fora da página de Metas.
