## Objetivo

Preencher o espaço vazio à direita dos dois gráficos de rosca (Receitas/Despesas) trazendo os cards de "Categorias" (que hoje aparecem logo abaixo) para o lado dos donuts, formando uma única linha visual coesa no dashboard.

## Layout proposto

```text
┌──────────────────────────────────────────────────────────────┐
│ Categorias — Receitas e Despesas                             │
│ ┌──────────────┐  ┌────────────────────────────────────────┐ │
│ │ Receitas     │  │  [Alimentação] [ADMIN.]  [Implantes]   │ │
│ │  (donut +    │  │  [SALÁRIOS]    [Impl.]   [PESSOAIS]    │ │
│ │   legenda)   │  │  ... (top 6 despesas em grid 2–3 col)  │ │
│ ├──────────────┤  │                                        │ │
│ │ Despesas     │  │                                        │ │
│ │  (donut +    │  │                                        │ │
│ │   legenda)   │  │                                        │ │
│ └──────────────┘  └────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Alterações

### 1. `CategoryBreakdownCard.tsx`
- Voltar os dois donuts para **empilhados** (coluna única) já que ocuparão apenas a metade esquerda do card em telas grandes.
- Remover o `xl:grid-cols-2` interno; manter apenas o layout vertical com um separador horizontal entre Receitas e Despesas.
- Aceitar via props os dados do grid de detalhes (categorias despesa, total, transações, ranges, loading) para renderizar `CategoryDetailGrid` ao lado direito.
- Nova estrutura no `CardContent`:
  - `grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6`
  - Coluna esquerda: os dois donuts empilhados
  - Coluna direita: `CategoryDetailGrid` (renderizado sem seu próprio `Card` wrapper)

### 2. `CategoryDetailGrid.tsx`
- Adicionar prop `embedded?: boolean`. Quando `true`, renderizar **sem** o `Card/CardHeader/CardContent` (apenas o grid interno), pois passará a viver dentro do `CategoryBreakdownCard`.
- Ajustar o grid interno para `grid-cols-1 sm:grid-cols-2` (em vez de `lg:grid-cols-3`) porque o espaço disponível será mais estreito que a largura total.
- Manter comportamento atual (top 6, sparkline, delta, navegação).

### 3. `Dashboard.tsx`
- Remover o bloco separado `<CategoryDetailGrid ... />` (linhas ~264-274).
- Passar suas props para `<CategoryBreakdownCard>` para que ele orquestre a renderização embutida.

## Fora do escopo
- Lógica de cálculo (top 6, sparkline, delta) permanece intacta.
- Nenhuma mudança nas queries, hooks ou modelos de dados.
- Sem alterações em `DashboardCreditCardsRow` ou outras seções.

## Comportamento responsivo
- `< xl` (inclui o viewport atual de 880px): tudo continua empilhado verticalmente (donuts em cima, cards de categoria embaixo) — mesma experiência de hoje em telas médias/pequenas.
- `≥ xl`: donuts à esquerda em coluna, cards de categoria preenchem o espaço à direita.
