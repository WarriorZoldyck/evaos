# Ajustes na página de Metas

## 1. Remover o chat da EVA
Excluir o componente de conversa da EVA do detalhe da meta e o arquivo `GoalChat.tsx`, junto com o estado/handlers usados só por ele (envio de mensagem, sugestões de chips e tratamento de resposta). Os demais blocos de acompanhamento (score, progresso, plano de ação, resolução) continuam iguais.

## 2. Remover o card "Saldo total"
Tirar a linha do Saldo total do topo da grade de Metas Orçamentárias. O valor continua sendo calculado internamente (é usado no cálculo da sobra e nos diagnósticos), apenas deixa de ser exibido nessa página.

## 3. Padronizar os cards
Hoje alguns cards mostram título à esquerda e valor à direita na mesma linha, enquanto outros já mostram o título em cima e o valor embaixo. Padronizar o card de métrica para o formato empilhado: ícone + título em cima, valor grande logo abaixo. Isso alinha "Média de entradas / mês", "Média de saídas / mês" e "Capacidade mensal estimada" com os cards de Meta e de Realizado, deixando as alturas das linhas consistentes.

## 4. Fechar as categorias ao clicar fora
Quando o usuário abre a lista de categorias (entradas ou saídas), clicar em qualquer área fora do bloco de planejamento fecha a lista, devolvendo a visão compacta e o acesso à parte superior da tela. Cliques dentro dos cards, sliders e da própria lista não fecham. A tecla Esc também fecha.

## Detalhes técnicos
- `src/pages/MetaDetalhe.tsx`: remover import/uso de `GoalChat`, `CHAT_CHIPS`, `handleReply` e `buildContext` se ficarem órfãos; apagar `src/components/metas/planejamento/GoalChat.tsx`. Manter `AssistantService` apenas se ainda usado por outro ponto (checar antes de remover imports).
- `src/pages/Metas.tsx`: remover o `PairRow` com `RealBalanceCard`; adicionar `ref` no container do planejamento e um listener `pointerdown` no documento para `setOpenBlock(null)` quando o clique for fora, além de `keydown` Esc.
- `src/components/metas/planejamento/FinancialMetricCard.tsx`: mudar o layout interno de linha para coluna (título em cima, valor abaixo, `rightSlot` alinhado ao valor), mantendo tons e variante interativa.
- `RealBalanceCard` pode permanecer exportado (usado em outros pontos, como `MetasSidebar`), apenas deixa de ser renderizado em Metas.
