# Planejamento Inteligente (evolução da página Cofrinhos)

Transformar `/metas` em um centro de planejamento em 3 colunas, com estética glass + soft neumorphism na identidade EVA (ciano #00B4D8 / #48CAE4), usando a imagem de referência como benchmark de composição — sem o grande alvo circular do topo.

## Layout

```text
[ COLUNA ESQUERDA 360px ][ CENTRO (flex) ][ COLUNA DIREITA 340px ]
 Visão geral              Título+Subtítulo   Progresso da meta
 Saldo total              Card meta atual    (ring + mini gráfico)
 Média entradas/mês       Chat da EVA        Plano de ação
 Média saídas/mês         Chips sugestão     Ver plano completo
 Sobra estimada           Input mensagem
 Card META ATIVA
 META SCORE (ring)
```

Mobile/tablet: empilha na ordem visão geral → meta → chat → progresso → plano de ação. Sem overflow horizontal.

## O que muda

- `src/pages/Metas.tsx`: passa a montar as três colunas. A lista de cofrinhos existente vira um bloco compacto abaixo do chat (com o botão "+" e o `GoalFormModal` atuais preservados), e o clique continua indo para `/metas/:id`.
- `src/components/metas/MetasSidebar.tsx`: mantém os mesmos dados reais (`useMetasSidebarStats`), só ganha nova apresentação (cards glass, ícone, valor grande). A expansão por categorias e o `ActionPlanDialog` continuam funcionando.
- Novos componentes em `src/components/metas/planejamento/`: `FinancialMetricCard`, `ActiveGoalCard`, `GoalScoreRing`, `GoalStatusBadge`, `CurrentGoalCard`, `GoalChat`, `ChatMessage`, `ChatInput`, `SuggestionChip`, `GoalProgressPanel`, `GoalChart`, `ActionPlan`, `ActionPlanItem`.

## Fonte única de dados da meta

Um hook `usePlanningGoal(goals, stats)` deriva de uma única estrutura:

```ts
{ id, title, type, targetAmount, currentAmount, deadline, monthlyContribution, score, status }
```

A meta ativa é a primeira meta real do usuário (contexto Pessoal/Empresa atual). Card lateral, card central, ring de score, barra de progresso e gráfico leem todos daqui — sem duplicação de estado, sem valores hardcoded.

## Atingibilidade e score

Camada pura em `src/lib/goalPlanning.ts` (com testes):
- meses restantes até o prazo, aporte necessário = (alvo − guardado) / meses;
- compara com a sobra mensal estimada (`stats.leftover` / meses restantes);
- retorna `ATINGIVEL | ATINGIVEL_COM_AJUSTES | EM_RISCO | NAO_ATINGIVEL` + score 0–100.
- sem prazo ou sem dados suficientes: "Precisamos de mais informações para avaliar sua meta." Nada de números inventados.

## Chat

`GoalChat` é puramente visual/estado; recebe um `sendMessage(history) => Promise<AssistantReply>` por prop. Nesta entrega a implementação é um resolvedor local (`localGoalPlanner`) que interpreta respostas de prazo e de aporte mensal ("consigo guardar R$ 800") e devolve texto + um patch opcional da meta (aporte, prazo, status, score, plano). Trocar por chamada ao agente real depois é substituir só essa função.

Inclui: mensagens usuário/EVA, timestamps, scroll interno, estado "EVA está pensando…", chips de resposta rápida (Até 6 meses / 1 ano / 2 anos / 3 anos ou mais), input com envio por Enter e animação suave de entrada.

Quando o chat devolve um patch, progresso, score e plano de ação atualizam na hora (estado local da sessão — nada é gravado no banco sem ação explícita do usuário).

## Plano de ação

Itens derivados das maiores categorias de gasto (`stats.topCategories`) + aporte mensal necessário, com estados Concluído / Em andamento / Pendente. "Ver plano completo" abre o `ActionPlanDialog` existente (IA já integrada).

## Estilo

- Novos utilitários em `src/index.css` no escopo `.metas-scope`: `.glass-card` (branco translúcido + backdrop-blur + borda sutil), variação neumórfica suave reaproveitando `.neu-card`, e ajuste do `--primary` do escopo para o ciano EVA em vez do verde atual.
- Somente tokens semânticos nos componentes; sem cores hardcoded.
- Microinterações curtas (hover de card, entrada de mensagem, animação do ring).

## Não muda

Rotas, providers, auth, hooks de dados, Supabase, cálculos financeiros, sidebar, header, outras páginas. Nenhuma dependência nova (ring em SVG, gráfico com o Recharts já presente).

## Verificação final

Typecheck + lint, checagem visual em 1440/1280/tablet/mobile via preview, sem overflow horizontal e sem erros no console.
