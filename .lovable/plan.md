# Insight da EVA + confirmação ao criar meta pela simulação

Duas adições na página Metas (Planejamento Inteligente), sem tocar em nada fora de `/metas`.

## 1. Card "Insight da EVA" na coluna da direita

Novo card, último da coluna lateral (abaixo dos cards de ganho/economia e do botão de criar meta), com o resumo de acompanhamento de cada meta:

- Nome da meta e valor-alvo.
- Quanto já foi alcançado (valor guardado) e quanto falta, com barra de progresso e percentual.
- Ritmo: quanto precisa guardar por mês até o prazo x quanto a simulação atual permite guardar por mês.
- Veredito curto e colorido: "Dentro do ritmo", "Levemente atrás" ou "Fora do ritmo", com a diferença em reais/mês e quantos meses de atraso ou adiantamento.
- Quando existe mais de uma meta, o card lista todas de forma compacta e destaca a meta ativa; sem metas, mostra um convite curto para criar a primeira.

O texto do insight é gerado por regra determinística (sem chamada de IA), para ser instantâneo e sempre coerente com os números da tela.

## 2. Confirmação ao clicar em "Criar meta com base nisso"

Hoje o botão abre direto o formulário de meta já preenchido. Passa a abrir antes um diálogo de confirmação que mostra:

- Nova capacidade mensal simulada (e a diferença vs. a real).
- Nova sobra projetada até dezembro (e a diferença vs. a real).
- De onde vem o valor: ganho extra simulado + economia simulada.
- Sugestão de destino do que sobra, com opções:
  - criar uma nova meta com o valor mensal cheio;
  - dividir entre as metas existentes (reforçar aporte mensal);
  - escolher um valor mensal menor que o simulado, com campo editável.
- Botões "Cancelar" e "Criar meta", que só então abrem o formulário já preenchido com nome, alvo, prazo e aporte mensal.

## Detalhes técnicos

- `src/pages/Metas.tsx`: passa `goals`, `activeGoalId`, `simulatedCapacity`, `simulatedLeftover`, `monthlyCapacityRaw` e `stats.leftover` para os novos componentes; o handler de `CreateGoalFromSimulation` passa a abrir o novo diálogo em vez do formulário.
- Novo `src/components/metas/planejamento/GoalInsightCard.tsx`: card de insight, puramente apresentacional.
- Novo `src/lib/goalInsight.ts`: cálculo do insight por meta (progresso, aporte necessário, folga/déficit, status) + testes unitários cobrindo meta sem prazo, meta concluída, atraso e adiantamento.
- Novo `src/components/metas/planejamento/CreateGoalFromSimulationDialog.tsx`: diálogo de confirmação com os números simulados e a escolha de destino.
- `FinancialOverview.tsx`: `CreateGoalFromSimulation` passa a emitir apenas o pedido de abertura do diálogo.
- Estilo mantido (glass/neomorph, tokens semânticos), responsivo até 880px de largura.
