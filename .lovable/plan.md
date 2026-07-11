## Objetivo
No card "Categorias — Receitas e Despesas" do Dashboard, o grid da direita deve listar **todas** as categorias do contexto atual (Pessoal/Empresa já é aplicado no `useDashboardData`), com um filtro Receitas/Despesas controlado pelo usuário, e alguns ajustes de UX.

## Mudanças

### 1. `CategoryDetailGrid.tsx`
- Novo prop `mode: "receita" | "despesa"` e `onModeChange`, além de `revenueCategories`/`expenseCategories` (ou receber ambos e o total correspondente). O grid decide qual lista renderizar com base em `mode`.
- Header interno (quando `embedded`) com um toggle segmentado compacto "Receitas | Despesas" alinhado à direita.
- **Remover o `.slice(0, 6)`** — renderiza todas as categorias, ordenadas desc por valor.
- **Destaque do maior item**: primeiro card recebe borda `border-primary/40` e um badge sutil "Maior" (ou ícone), sem quebrar o layout.
- **Bug de matching (sparkline + Δ%)**: hoje filtra `t.category === c.name`, mas `transactions.category` guarda UUID. Trocar para comparar por `c.id` com fallback ao nome (dados legados). Isso corrige `series` e `prevTotal`.
- **Densidade responsiva**: manter `grid-cols-1 sm:grid-cols-2`, mas dentro do card do Dashboard o container externo já é `xl:grid-cols-[1fr_1.4fr]`, então em xl fica 2 colunas e abaixo colapsa para 1.
- **Altura + scroll**: quando `embedded`, o grid vira flex column com `max-h` calculado para acompanhar a altura da coluna esquerda (dois donuts empilhados). Uso: wrapper com `h-full` + `overflow-y-auto` interno e `pr-1` para a barra.

### 2. `CategoryBreakdownCard.tsx`
- Estado local `detailMode` (`"receita" | "despesa"`, default `"despesa"`).
- Passa ambas as listas (`revenueCategories`, `expenseCategories`) + totais para o `CategoryDetailGrid` embedded, junto com `mode` e `onModeChange`.
- Coluna direita ganha `h-full` para permitir que o grid ocupe a mesma altura da coluna esquerda (donuts empilhados).

### 3. `Dashboard.tsx`
- Sem mudança estrutural; continua passando `detailTransactions`, `currentStart/End`, `prevStart/End`.

## Fora de escopo
- Lógica de agregação em `useDashboardData` (contexto Pessoal/Empresa já é aplicado lá — nada a mudar).
- Donuts da esquerda permanecem exatamente como estão.
- Nenhuma mudança em queries, hooks, tipos do Supabase ou regras de negócio.

## Detalhes técnicos
- Toggle: componente `Tabs` do shadcn ou par de `Button` com `variant="ghost"`/`"secondary"`. Prefiro `Tabs` inline compacto para consistência.
- Matching corrigido:
  ```ts
  const txsForCat = allTransactions.filter(
    (t) => t.type === mode && (t.category === c.id || t.category === c.name)
  );
  ```
- Ordenação: `[...categories].sort((a,b) => b.value - a.value)` (sem `slice`).
- Scroll: `<div className="h-full flex flex-col min-h-0"><Toggle/><div className="flex-1 min-h-0 overflow-y-auto pr-1">{grid}</div></div>`.
