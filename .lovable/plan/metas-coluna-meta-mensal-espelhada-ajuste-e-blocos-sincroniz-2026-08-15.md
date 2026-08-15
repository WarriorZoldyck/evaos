# Metas — coluna "Meta mensal" espelhada, ajuste +/− e blocos sincronizados

## 1. Estrutura de colunas

- **Esquerda — Planejamento fin.**: Saldo total, Média de entradas, Média de saídas, Capacidade mensal, Sobra até dez. Sempre fixa, é a base de comparação (nunca muda ao simular).
- **Direita — Meta mensal**: espelha a esquerda **a partir da Média de entradas** para baixo. O card de Saldo não aparece nesse lado; no topo fica só o cabeçalho "Meta mensal" com o resumo do mês simulado.
- **Faixa de resumo**: dois cards ao lado/abaixo — "Ganho total" e "Meta de economia", cada um mostrando valor por mês e por ano.

```text
Planejamento fin.        Meta mensal            Resumo
[ Saldo ]                (sem saldo)            [ Ganho total  mês/ano ]
[ Média entradas ]  <->  [ Entradas meta +/- ]  [ Meta economia mês/ano ]
[ Média saídas   ]  <->  [ Saídas meta +/-   ]
[ Capacidade     ]  <->  [ Nova capacidade   ]
[ Sobra até dez  ]  <->  [ Nova sobra        ]
```

## 2. Abrir/fechar sincronizado

- Um bloco aberto por vez (entradas **ou** saídas).
- Clicar em "Média de entradas" (de qualquer lado) abre a lista de categorias nos **dois** lados ao mesmo tempo e fecha o bloco de saídas nos dois.
- Clicar em "Média de saídas" faz o inverso.
- Com os dois blocos recolhidos, ficam visíveis a comparação Capacidade média x Nova capacidade e Sobra atual x Nova sobra.

## 3. Ajuste para mais e para menos

- Hoje entradas só sobem e saídas só descem. Passa a aceitar **+ e −** nos dois blocos (mês atípico: viagem aumenta a saída, renda extra aumenta a entrada, e vice-versa).
- Cada categoria da coluna direita tem: campo em R$ (máscara BRL) e campo em % com sinal, mais botões rápidos − / +.
- Digitar em qualquer um dos dois atualiza o outro; a coluna esquerda permanece intocada.

## 4. Atualização em tempo real

Ao alterar qualquer categoria, recalcula imediatamente na direita: nova média de entradas, nova média de saídas, nova capacidade mensal, nova sobra até dezembro e os dois cards de resumo (ganho total e economia, mês e ano). A esquerda continua fixa como referência.

## 5. Cards de resumo

- **Ganho total**: soma dos aumentos de entrada — valor/mês e valor/ano (mês × meses restantes do ano).
- **Meta de economia**: soma das reduções de saída — valor/mês e valor/ano.
- O botão "Criar meta com base nisso" continua, usando ganho + economia por mês.

## Detalhes técnicos

- `src/pages/Metas.tsx`: substituir o par de estados `selectedIncome`/`selectedExpense` sempre abertos por um estado único `openBlock: "income" | "expense" | null` compartilhado pelas duas colunas; montar o grid em duas colunas espelhadas (esquerda real, direita meta) mais a faixa de cards de resumo.
- `src/components/metas/planejamento/FinancialOverview.tsx`:
  - `RealAverageBlock` e `SimulatedCategoryList` passam a receber `open` e `onToggle` e só renderizam a lista quando abertos.
  - `sumSimulated` e os cálculos de `projected` deixam de usar `Math.max(0, …)` e passam a aceitar percentuais negativos (saídas continuam com piso em 0 no valor absoluto).
  - `OverviewDetailPanel` aceita percentual negativo nos dois modos e o campo BRL deixa de travar no valor original.
  - Novos cards `GainTotalCard` e `SavingGoalCard` com linhas mês/ano.
- Nenhum arquivo fora de `/metas` é alterado; sem mudança de banco de dados.
