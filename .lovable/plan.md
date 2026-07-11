# Plano: eliminar espaços em branco no dashboard + cabeçalho fixo

## 1) Grid dos cards principais
- `SummaryCards.tsx`: trocar `xl:grid-cols-6` por `xl:grid-cols-5` no grid principal.
  - Motivo: existem 5 cards (Saldo Atual, Faturamento, Entradas, Saídas, Saldo do Período). Em telas ≥1280px a grid criava uma 6ª coluna vazia à direita, gerando o vão em branco visível no print.
- Manter os breakpoints menores: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5`.

## 2) Card "Saldo Atual" — preencher espaço vertical
Diferente dos vizinhos, ele não tem delta nem sparkline, ficando visualmente "curto".
- Adicionar `subtitle` informativo no `SummaryCard`:
  - `"{N} conta(s) · {M} carteira(s)"` calculado via `bankAccounts.length` e `wallets.length` (novos props opcionais no `SummaryCards`, alimentados pelo Dashboard).
- Adicionar `series={saldoSeries}` para ganhar a linha de sparkline na base — dá densidade equivalente aos demais cards sem inventar métrica nova (a série já representa o comportamento diário do saldo do período).
  - Manter `delta` ausente para não confundir (Saldo Atual é ponto-no-tempo, não período vs. período).

## 3) Cabeçalho fixo (título + filtros)
- No `Dashboard.tsx`, envolver o bloco `Header` (título + selector de conta + `PeriodFilter`) em um container:
  - `sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/90 backdrop-blur-md border-b border-border/60`
  - Isso o mantém colado ao topo da área de conteúdo (dentro do `overflow-auto` do `AppLayout`), abaixo do header global (que já é sticky com `z-40`).
- Reduzir levemente o `space-y-6` do container raiz para `space-y-4` no mobile e `md:space-y-6` para compensar o padding extra do sticky (opcional; só se surgir gap duplicado).
- `FinancialHealthBar` **não** entra no sticky para não ocupar demais na rolagem — só cabeçalho (título + filtros).

## Detalhes técnicos
- Arquivos alterados:
  - `src/pages/Dashboard.tsx` — wrapper sticky no header; passa `bankAccountsCount` e `walletsCount` para `SummaryCards`.
  - `src/components/dashboard/SummaryCards.tsx` — grid `xl:grid-cols-5`; novos props opcionais `bankAccountsCount`, `walletsCount`; card "Saldo Atual" recebe `subtitle` e `series`.
- Semantic tokens apenas (`bg-background/90`, `border-border/60`) — sem cores hardcoded.
- Sem mudanças em dados, hooks ou lógica.

## Fora de escopo
- Redesign visual dos cards (formas, gradientes, ícones).
- Alterações na linha de forecast (Entradas/Saídas/Saldo previstos) — já ocupa 3 colunas corretamente.
- Sticky do `FinancialHealthBar` ou de outras seções.
