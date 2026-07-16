## Objetivo
Resolver o layout quebrado da barra de filtros fixa em `/lancamentos` reduzindo a quantidade de controles visíveis, agrupando-os em dropdowns com ícone de funil.

## Mudanças

### 1. `src/components/lancamentos/TransactionFilters.tsx`
- **Remover** os dois `ToggleGroup` inline atuais ("Tudo/Entradas/Saídas" e "Todos/Conciliados/Sem conciliação").
- **Criar dois novos dropdowns** (usando `DropdownMenu` do shadcn) na mesma linha fixa:
  - **Dropdown "Tipo"**: ícone `Filter` (funil) + label dinâmico ("Tudo", "Entradas" ou "Saídas"). Ao abrir, mostra as 3 opções como itens selecionáveis (`DropdownMenuRadioGroup`). Quando um filtro estiver ativo (≠ "Tudo"), o botão ganha destaque visual (ex.: `variant="default"` ou badge de cor) para indicar seleção.
  - **Dropdown "+ Filtros"**: ícone `Filter` + texto "+ Filtros". Ao abrir, mostra as opções de conciliação ("Todos", "Conciliados", "Sem conciliação") como `DropdownMenuRadioGroup`. Também recebe destaque visual quando algo diferente do padrão estiver ativo, com badge numérico opcional indicando "1" filtro extra.
- **Manter** ordenação, categorias, contas, fornecedores e clientes como estão (dropdowns já existentes).
- **Redistribuir espaçamento**: como agora são 2 controles a menos, a linha cabe melhor; ajustar `gap` e larguras dos selects (`w-[160px]` a `w-[180px]`) para ocupar o espaço de forma equilibrada, mantendo `flex-wrap` como fallback em telas muito estreitas.

### 2. `src/pages/Lancamentos.tsx`
- Nenhuma mudança estrutural; a barra fixa permanece igual, apenas o conteúdo interno (TransactionFilters) fica mais compacto.
- Reavaliar altura da barra fixa caso encolha (provavelmente uma única linha em telas médias).

### 3. `src/components/layout/AppLayout.tsx`
- Sem mudanças planejadas — o header global já foi ajustado na iteração anterior. Só validar visualmente que continua consistente.

## Fora do escopo
- Lógica dos filtros (valores, estado, callbacks) — permanece intacta; muda apenas a UI que aciona os handlers existentes (`onTypeChange`, `onConciliationChange`).
- Dados, tabela, import/export, Supabase.

## Validação
- Verificar via Playwright (viewport ~880px e ~1280px) que:
  1. A barra fixa cabe em uma linha sem quebras estranhas.
  2. Os dois dropdowns abrem e selecionam corretamente.
  3. O estado ativo é visualmente indicado.
  4. As transações não aparecem mais atrás da barra ao rolar.
