# Metas — Planejamento Financeiro Inteligente

Reimaginar `/metas` como um painel premium de 3 colunas (glassmorphism + soft neumorphism, gradiente EVA), mantendo intactas as regras de negócio, hooks, rotas, providers e chamadas de API existentes. A mudança é de camada visual + composição, com uma exceção calculada: o Meta Score, que é derivado de dados que já buscamos hoje.

## Layout

```text
┌───────────────┬──────────────────────────┬───────────────┐
│ VISÃO GERAL   │  HERO DA META ATIVA      │ PROGRESSO     │
│ Saldo total   │  nome, objetivo, faltam, │ anel + curva  │
│ Entradas/mês  │  prazo, status           │ guardado×meta │
│ Saídas/mês    ├──────────────────────────┤               │
│ Sobra até dez │  CHAT (visual)           │ TIMELINE      │
│ META ATIVA    │  bolhas IA / usuário     │ marcos        │
│ META SCORE    │  chips + campo de texto  │ PLANO DE AÇÃO │
└───────────────┴──────────────────────────┴───────────────┘
```

Mobile/tablet: colunas empilham na ordem hero → progresso/plano → chat → KPIs.

## Decisões confirmadas

- **Chat**: só camada visual nesta etapa. Estado local (`useState`), roteiro guiado de mensagens, chips de sugestão e campo de envio funcionando na UI, sem chamada de IA. A conexão real fica para uma etapa seguinte.
- **Lista de cofrinhos**: substituída. Vira um seletor compacto no topo da coluna esquerda; a meta escolhida é a "meta ativa" que alimenta hero, progresso, timeline e score. Continua sendo possível criar meta e abrir o detalhe (`/metas/:id`).
- **Meta Score**: cálculo determinístico real (sem IA), a partir de sobra mensal média, valor faltante e prazo.

## Meta Score — regra

Meses restantes até o prazo (`deadline`) versus meses necessários (`faltante ÷ sobra mensal média`). Faixas: ≥95% "Muito provável", 70–94% "Provável", 40–69% "Apertado", <40% "Requer ajuste". Sem prazo definido, o card mostra "Sem prazo" e a projeção de conclusão em meses, em vez de percentual. Sobra mensal ≤ 0 força o estado "Requer ajuste" e destaca o botão de plano de ação já existente.

## Componentes novos (`src/components/metas/premium/`)

Todos novos e reutilizáveis; nenhum componente atual é alterado internamente.

- `GlassCard.tsx` — casca visual (blur, borda, sombra) usada por todos os demais
- `KPIWidget.tsx` — KPI com label, valor, ícone, sparkline opcional e estado expansível
- `ProgressRing.tsx` — anel de progresso em SVG
- `SuggestionChip.tsx` — chip clicável
- `ChatBubble.tsx` — bolha única (papel, texto, horário)
- `GoalChat.tsx` — transcript + chips + composer (estado local)
- `GoalHero.tsx` — cabeçalho da meta ativa com métricas em linha
- `GoalScore.tsx` — Meta Score com anel e veredito
- `GoalProgressPanel.tsx` — anel + curva guardado × meta
- `GoalTimeline.tsx` — marcos da meta
- `GoalActionPlanPanel.tsx` — lista do plano de ação, reaproveitando o `ActionPlanDialog` atual para o "Ver plano completo"
- `GoalSwitcher.tsx` — seletor da meta ativa
- `EmptyState.tsx` — estado sem metas, com as sugestões atuais

## Design system

Um arquivo `src/styles/goals.css` com tokens no escopo `.metas-scope` (glass, borda, sombras neumórficas, raio 24px, blur 24px, gradiente EVA `#00B4D8 → #48CAE4`), importado uma vez. Cores expostas como tokens semânticos, sem classes de cor cruas (`bg-white`, `text-black`) nos componentes, e com variação para tema claro e escuro. Nenhuma biblioteca nova; Tailwind permanece.

## O que não muda

`useGoals`, `useMetasSidebarStats`, `useCompany`, `GoalFormModal`, `GoalAmountModal`, `GoalHistoryModal`, `ActionPlanDialog`, edge function `goal-action-plan`, rotas e RLS. `MetasSidebar.tsx` e `GoalListItem.tsx` deixam de ser usados por `/metas` mas não são apagados nesta etapa, para permitir reversão rápida.

## Ordem de execução

1. `goals.css` + `GlassCard`, `KPIWidget`, `ProgressRing`, `SuggestionChip`, `ChatBubble`
2. `GoalHero`, `GoalScore`, `GoalSwitcher`, `EmptyState`
3. `GoalChat`, `GoalProgressPanel`, `GoalTimeline`, `GoalActionPlanPanel`
4. Recomposição de `src/pages/Metas.tsx` e verificação visual (claro/escuro, mobile, sem metas, meta sem prazo)
