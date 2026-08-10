# Metas: corrigir números, abrir o simulador ao lado e arrumar o layout

## 1. Valores das categorias (manter a média mensal correta)

A referência continua sendo a **média por mês** de cada categoria, exatamente como já era exibido antes do simulador.

Hoje há uma divisão dupla: `useMetasSidebarStats` já entrega a média mensal (total do ano ÷ meses decorridos) e `simulateSavings` divide de novo por 12, achatando os números. Correção: o simulador recebe o valor já mensal e não divide de novo, então a lista mostra a mesma média mensal de antes, e o corte percentual é aplicado sobre ela.

## 2. Simulador abre ao lado, não embaixo

Hoje o painel de cortes é injetado dentro da coluna estreita, empurrando os cards e quebrando o layout.

Novo comportamento:
- Clicar em "Média de saídas / mês" (e em "Média de entradas / mês") abre um painel **à direita da coluna de cards**, ocupando o espaço do conteúdo central, sem mexer na altura nem na largura dos cards.
- Os cards da esquerda voltam ao tamanho/estilo anteriores (nada de encolher).
- No mobile (abaixo de `lg`), o painel volta a aparecer logo abaixo do card, já que não há espaço lateral.

```text
[ cards ]  [ painel de saídas / simulador ]  [ conteúdo da meta ]
```

- Dentro do painel: lista de categorias com o valor mensal real, slider de corte por categoria, resumo da economia simulada e botão "Criar meta com essa economia" (pré-preenche o formulário).

## 3. Card "Crie um cofrinho para ver progresso, score e plano de ação."

Ele hoje flutua solto num canto da grade. Passa a ficar dentro da área central de painéis, alinhado com a largura do conteúdo (ou é simplesmente omitido quando o estado vazio já está sendo mostrado acima, evitando a mensagem duplicada).

## Detalhes técnicos

- `src/components/metas/planejamento/FinancialOverview.tsx`: separar o painel expandido do componente de cards; expor qual card está aberto para o pai renderizar o painel na coluna ao lado.
- `src/pages/Metas.tsx`: grade com slot lateral para o painel expandido; reposicionar o card de estado vazio dos painéis.
- `src/components/metas/planejamento/FinancialMetricCard.tsx`: reverter a compactação (padding/tipografia anteriores).
- `src/lib/savingsSimulator.ts` + teste: aceitar valores já mensais para não dividir duas vezes.
- Sem alterações de banco nem fora da área de Metas.
