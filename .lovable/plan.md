## Objetivo

1. Mover a **barra de busca** para o cabeçalho global fixo, à esquerda (ao lado do ícone de recolher menu).
2. Deixar a linha de filtros (Tudo/Entradas/Saídas, Todos/Conciliados/Sem conciliação, Recentes, Categoria, Conta, Fornecedor, Cliente) **fixa no topo** durante a rolagem — com fundo sólido, sem transparência.

## Mudanças

### `src/contexts/HeaderSlotContext.tsx`
- Adicionar segundo slot: `leftContent` / `setLeftContent` + hook `useHeaderLeftSlot(node)`.
- Motivo: hoje só existe o slot central; precisamos de um slot à esquerda (perto do `SidebarTrigger`) para a busca.

### `src/components/layout/AppLayout.tsx` (`AppHeader`)
- Consumir `leftContent` via `useHeaderLeftSlotContent()` e renderizar imediatamente após o `SidebarTrigger`, dentro do bloco esquerdo existente.
- Nenhuma outra mudança no cabeçalho (mantém `glass-strong sticky top-0 z-40`).

### `src/components/lancamentos/TransactionFilters.tsx`
- Extrair a busca em um subcomponente exportado `TransactionSearchInput` (compacto: `w-64 h-8 text-sm`, ícone `Search` à esquerda) que lê/escreve `filters.search`.
- Adicionar prop `hideSearch?: boolean` em `TransactionFilters`; quando `true`, omitir o bloco de busca da grid.
- Nenhuma mudança de lógica/dados.

### `src/pages/Lancamentos.tsx`
- Importar `TransactionSearchInput` e `useHeaderLeftSlot`.
- `useHeaderLeftSlot(<TransactionSearchInput filters={filters} onFiltersChange={setFilters} />)` (memoizado).
- Passar `hideSearch` para `<TransactionFilters>`.
- Envolver `<TransactionFilters>` em container **sticky opaco**:
  ```tsx
  <div className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background border-b border-border/60">
    <TransactionFilters ... hidePeriod hideSearch />
  </div>
  ```
  - `sticky top-0` gruda no topo do container de rolagem (`overflow-auto` de `AppLayout`), logo abaixo do cabeçalho global (que é fixo fora do scroll).
  - `bg-background` sólido resolve o vazamento visual do conteúdo passando por trás.
  - `-mx-4 md:-mx-6` + `px-4 md:px-6` estendem o fundo até as bordas do padding da página.
  - `z-30` fica abaixo do cabeçalho global (`z-40`) e não conflita com popovers.
- O bloco de título "Lançamentos / N lançamentos" e o banner de novidade continuam rolando normalmente. Tabs (Todos/Realizado/Projetado) e tabela permanecem inalterados.

## Layout final do cabeçalho global (na página Lançamentos)

```text
[≡] [Buscar…]        [Tudo|Hoje|Sem|Mês|Ano] [‹ Jul 2026 ›] [Exportar] [Importar] [+ Novo]        [☀]
```

E ao rolar a página, logo abaixo do cabeçalho aparece a barra fixa opaca:

```text
[Tudo|Entradas|Saídas] [Todos|Conciliados|Sem conciliação] [↓ Recentes] [Categoria ▾] [Conta ▾] [Fornecedor ▾] [Cliente ▾]
```

## Fora de escopo
Queries/hooks/schema, `Pagar Fatura`, banner de novidade, tabela, outras páginas.