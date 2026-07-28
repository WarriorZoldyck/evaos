
## Objetivo

Adicionar um painel lateral à página **Metas** (`/metas`) com 4 cards financeiros do contexto ativo (Pessoal/Empresa) e um "plano de ação" que aparece quando a meta deixa a sobra do ano negativa. O plano começa com heurística local e ganha um botão **"Pedir sugestão à EVA"** que chama a IA sob demanda.

## Layout

Reestruturar `src/pages/Metas.tsx` de `max-w-2xl mx-auto` para grid `lg:grid-cols-[320px_1fr]`:

```text
┌──────────────┬──────────────────────────────┐
│  Painel      │  Cofrinhos (conteúdo atual)  │
│  lateral     │  - Total guardado            │
│              │  - Lista de metas            │
│  - Saldo     │                              │
│  - Gasto ano │                              │
│  - Projeção  │                              │
│  - Sobra     │                              │
│  - Plano ⚠️  │                              │
└──────────────┴──────────────────────────────┘
```

Em telas < `lg`, painel vai para o topo (empilhado). No lugar demarcado em vermelho pelo usuário, hoje só existe espaço vazio no grid — o painel ocupa exatamente essa coluna.

## Cards do painel

Um card por métrica, usando `Card` do shadcn com tokens semânticos (sem `text-white` hardcoded):

1. **Saldo total do contexto** — soma de saldos atuais das contas filtradas pelo contexto ativo.
2. **Gasto acumulado no ano** — soma de `transactions` `type=despesa` com `payment_date` entre 01/jan e hoje, filtrado por contexto (exclui transferências internas via `is_internal_transfer=false`).
3. **Projeção de saídas do ano** — soma de despesas pendentes até 31/dez + projeção de recorrentes via lógica já existente em `useRecurringTransactions`.
4. **Sobra estimada** — `saldo - projeção`. Se ≤ 0, card fica em `bg-destructive/10 border-destructive/40` e mostra o gap.

Todos reagem ao seletor global de contexto (via `useCompany()` — já usado na página).

## Plano de ação (déficit)

Aparece nos dois pontos combinados:

**A) Card fixo no painel** — visível sempre que sobra ≤ 0 OU total de metas ativas > sobra. Mostra:
- Gap consolidado em R$
- Top 3 categorias de despesa do ano (heurística local: agrupa `transactions` por `category`, ordena por total, sugere corte proporcional para fechar o gap).
- Botão **"Pedir sugestão à EVA"** → chama edge function.

**B) Aviso no `GoalFormModal`** — no submit, se a nova/editada meta empurrar a sobra para negativo, abre um `AlertDialog` com o mesmo conteúdo do card, exigindo confirmação para salvar.

## Edge function IA (nova)

`supabase/functions/goal-action-plan/index.ts`:
- Auth JWT obrigatória (padrão do projeto).
- Recebe `{ gap_cents, top_categories: [{name, total_cents}], goal_name }`.
- Chama Lovable AI Gateway (`google/gemini-2.5-flash`, chat completions padrão do projeto — sem AI SDK, seguindo o padrão de `eva-chat`).
- Retorna `{ suggestions: string[] }` (3-5 ações concretas em pt-BR).
- Trata 402/429 com toast padrão via `errorMapper`.

Renderiza sugestões com `react-markdown` (já no projeto).

## Hooks/helpers novos

- `src/hooks/useMetasSidebarStats.ts` — agrega saldo/gasto/projeção/sobra a partir de `useAccounts`, `useTransactions` e `useRecurringTransactions` já existentes, memoizado por `contextKey`.
- `src/hooks/useTopExpenseCategories.ts` — top N categorias do ano no contexto ativo.
- `src/components/metas/MetasSidebar.tsx` — renderiza os 4 cards + card de plano.
- `src/components/metas/ActionPlanDialog.tsx` — dialog compartilhado usado tanto pelo botão do painel quanto pelo `GoalFormModal`.

## Escopo fora deste plano

- Sem alterações no schema do banco.
- Sem mexer em `MetaDetalhe`, apenas na listagem `/metas`.
- Sem novas permissões/RLS — reusa consultas já autorizadas dos hooks existentes.

## Arquivos afetados

- **Novos**: `MetasSidebar.tsx`, `ActionPlanDialog.tsx`, `useMetasSidebarStats.ts`, `useTopExpenseCategories.ts`, `supabase/functions/goal-action-plan/index.ts`.
- **Editados**: `src/pages/Metas.tsx` (grid + integração), `src/components/metas/GoalFormModal.tsx` (aviso no submit).
