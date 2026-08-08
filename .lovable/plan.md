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

## Camadas (sem lógica financeira em componente visual)

```text
UI (componentes burros)
  ↓ estado + ações
Goal Planning Logic (funções puras + hooks)
  ↓ contexto estruturado
AssistantService (interface)  →  LocalAssistantService (temporário)
```

## Meta ativa (sem acoplamento à "primeira meta")

Hook `useActiveGoal(goals)` expõe `{ activeGoalId, setActiveGoalId, activeGoal }`. A seleção é explícita (clique na lista de cofrinhos, e futuramente rota/persistência). Fallback nesta entrega: se `activeGoalId` for nulo, usa a primeira meta — apenas como valor inicial, nunca como regra embutida nos componentes.

`usePlanningGoal(activeGoal, stats)` deriva o modelo de apresentação:

```ts
{ id, title, targetAmount, currentAmount, deadline,
  monthlyCapacity, requiredContribution, monthsRemaining,
  score, status, explanation }
```

## Goal Score determinístico e explicável

`src/lib/goalPlanning.ts` (funções puras + testes). Nenhum score vem da IA.

```ts
type GoalScoreBreakdown = {
  monthsRemaining: number | null;
  accumulated: number;
  remainingAmount: number;
  requiredContribution: number | null;  // remaining / monthsRemaining
  monthlyCapacity: number;              // sobra mensal estimada
  capacityGap: number;                  // capacity - required
  coverageRatio: number | null;         // capacity / required
};
type GoalStatus = "ATINGIVEL" | "ATINGIVEL_COM_AJUSTES" | "EM_RISCO" | "NAO_ATINGIVEL" | "DADOS_INSUFICIENTES";
computeGoalScore(input): { score: number; status: GoalStatus; breakdown: GoalScoreBreakdown }
```

Score 0–100 derivado de `coverageRatio` e do progresso acumulado, com faixas fixas para o status. Sem prazo ou sem dados suficientes → `DADOS_INSUFICIENTES` e mensagem "Precisamos de mais informações para avaliar sua meta". O breakdown é exibível item a item na UI (aporte necessário, capacidade mensal, meses restantes, acumulado, distância).

## AssistantService

```ts
interface GoalPlanningContext {
  goal: PlanningGoal | null;
  financialStats: MetasSidebarStats;
  topCategories: CategoryBreakdown[];
  conversationHistory: ChatMessage[];
}
interface AssistantReply { text: string; goalPatch?: Partial<PlanningGoal>; actions?: ActionPlanItem[]; }
interface AssistantService { sendMessage(ctx: GoalPlanningContext): Promise<AssistantReply>; }
```

`LocalAssistantService` é a implementação temporária: interpreta prazo e aporte informados pelo usuário e responde **sempre** a partir do contexto financeiro real (capacidade, categorias, breakdown). Nunca calcula score — delega a `computeGoalScore`. `GoalChat` recebe o service por prop/injeção e não conhece o mock; trocar pelo agente EVA real é registrar outra implementação.

## Plano de ação estruturado

```ts
type ActionPlanKind = "REDUCE_EXPENSE" | "INCREASE_INCOME" | "INCREASE_CONTRIBUTION"
  | "EXTEND_DEADLINE" | "REDUCE_TARGET" | "INVESTMENT";
type ActionPlanItem = {
  id: string; kind: ActionPlanKind; title: string; description: string;
  status: "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDO";
  estimatedMonthlyImpact: number | null; category?: string; amount?: number;
  source: "SISTEMA" | "IA";
};
```

Gerador puro `buildActionPlan(breakdown, topCategories)` produz itens do sistema; itens vindos do assistente entram com `source: "IA"`. "Ver plano completo" abre o `ActionPlanDialog` existente.

## Meta não atingível → área de resolução

Em vez de só um status negativo, o painel mostra o bloco "Como podemos tornar essa meta possível?" com opções acionáveis (Aumentar prazo, Reduzir gastos, Aumentar renda, Aumentar aporte, Combinar estratégias). Cada opção despacha uma ação tipada que recalcula o cenário localmente (`applyResolution(goal, action)` puro) e atualiza score, progresso e plano na hora — sem gravar no banco sem confirmação explícita.

## Componentes (pequenos, apenas apresentação)

`src/components/metas/planejamento/`: `FinancialMetricCard`, `ActiveGoalCard`, `GoalScoreRing`, `GoalScoreBreakdownList`, `GoalStatusBadge`, `GoalChat`, `ChatMessage`, `ChatInput`, `SuggestionChip`, `GoalProgressPanel`, `GoalChart`, `ActionPlanList`, `ActionPlanItemRow`, `GoalResolutionPanel`.

## Estilo

- Novos utilitários em `src/index.css` no escopo `.metas-scope`: `.glass-card` (translúcido + backdrop-blur + borda sutil), variação neumórfica suave reaproveitando `.neu-card`, e ajuste do `--primary` do escopo para o ciano EVA em vez do verde atual.
- Somente tokens semânticos; sem cores hardcoded e sem valores financeiros hardcoded.
- Microinterações curtas (hover de card, entrada de mensagem, animação do ring).


## Não muda

Rotas, providers, auth, hooks de dados, Supabase, cálculos financeiros, sidebar, header, outras páginas. Nenhuma dependência nova (ring em SVG, gráfico com o Recharts já presente).

## Verificação final

Typecheck + lint, checagem visual em 1440/1280/tablet/mobile via preview, sem overflow horizontal e sem erros no console.
