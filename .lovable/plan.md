## Objetivo

Aproveitar o header global do app (padrão Dashboard) na página **Lançamentos**: mandar pra lá os filtros de **período** (Tudo/Hoje/Semana/Mês/Ano + navegação < Jul 2026 >) e as ações **Exportar**, **Importar Extrato** e **+ Novo Lançamento**. O restante da barra de filtros (busca, Tudo/Entradas/Saídas, Todos/Conciliados/Sem conciliação, Recentes, Categorias, Contas, "Todos...") desce pra dentro da página e rola junto com a lista (sem sticky).

## Alterações

### 1. `src/pages/Lancamentos.tsx`
- Importar `useHeaderSlot` de `@/contexts/HeaderSlotContext`.
- Montar um `headerControls` (memo) com, da esquerda pra direita:
  - Bloco de período extraído do `TransactionFilters` — pílulas Tudo/Hoje/Semana/Mês/Ano + navegação com `<` / label do mês / `>`, ligadas ao mesmo `filters` (`period`, `dateFrom`, `dateTo`, mês atual).
  - Botão **Exportar** (o `ExportTransactionsButton` já existente).
  - Botão **Importar Extrato** (mesmo `onClick={() => setImportOpen(true)}`).
  - Botão **+ Novo Lançamento** (mesmo `onClick` de abrir o modal).
- Chamar `useHeaderSlot(headerControls)` — o `AppLayout` já renderiza esse slot dentro do header global sticky.
- Remover a barra sticky adicionada na iteração anterior. Manter apenas:
  - Título "Lançamentos / N lançamentos" no topo da página (sem os botões de ação).
  - Botão **Pagar Fatura** (quando `filters.accountId` é um cartão) fica no bloco do título, à direita — não vai pro header global (é contextual).
  - `<TransactionFilters />` em fluxo normal (sem `sticky`), sem os pills de período (ver item 2).

### 2. `src/components/lancamentos/TransactionFilters.tsx`
- Extrair a linha de **período** (pílulas + navegação de mês) em um subcomponente exportado (`TransactionPeriodFilter`) reaproveitável, para o Lançamentos renderizar no header global.
- Adicionar uma prop `hidePeriod?: boolean` no `TransactionFilters` para esconder a linha de período quando ela já estiver no header (default `false`, mantém compatibilidade com outros lugares que porventura usem).
- Nenhuma mudança de lógica: os dois componentes leem/escrevem o mesmo `filters` via `onFiltersChange`.

### 3. Estilo dos controles no header global
- Usar as classes já usadas no `Dashboard.tsx` (`h-8 text-xs`, botões `size="sm"`, gaps compactos) para o período e as ações caberem no header (altura `h-14`).
- No mobile, permitir `flex-wrap` como já faz o header global (linha 110 do `AppLayout.tsx`).

## Fora de escopo

- Sem mudanças em dados/queries, no schema, ou em Análises EVA / outras páginas.
- Sem mudanças no `AppLayout`.
- O botão "Pagar Fatura" continua contextual dentro da página (não sobe pro header).
