## Objetivo
Melhorar a usabilidade da barra de filtros de Lançamentos:
1. Reverter "Tipo" (Tudo/Entradas/Saídas) e "Conciliação" (Todos/Conciliados/Sem conciliação) para os `ToggleGroup` inline como estavam antes dos dropdowns de funil.
2. Unificar **Categorias, Fornecedores e Clientes** em um único filtro tipo "Google Ads": o usuário abre o filtro, escolhe o nível (Categoria / Fornecedor / Cliente) e o painel navega para as opções daquele nível.

## Arquivo alterado
`src/components/lancamentos/TransactionFilters.tsx` (único arquivo — lógica de filtros e handlers já existentes permanecem).

### 1. Reverter Tipo e Conciliação
- Remover os dois `DropdownMenu` de funil que criei.
- Voltar aos `ToggleGroup` originais:
  - Tipo: `Tudo | Entradas | Saídas` (com ícones `ArrowUp`/`ArrowDown`).
  - Conciliação: `Todos | Conciliados | Sem conciliação`.
- Manter `h-10` para alinhamento vertical consistente.

### 2. Filtro unificado "Entidades" (Categoria / Fornecedor / Cliente)
Componente novo local (dentro do mesmo arquivo, para escopo mínimo):

- Um único botão `Popover` rotulado **"Filtrar por"** com ícone `Tag` (ou `Filter`) + badge com contagem de filtros ativos entre os três.
- Ao abrir, mostra uma **lista de níveis**:
  ```
  › Categoria       [valor atual, se houver]
  › Fornecedor      [valor atual, se houver]
  › Cliente         [valor atual, se houver]
  ```
- Ao clicar em um nível, o painel **navega** (substitui o conteúdo, com um botão "← Voltar" no topo) para a lista de opções daquele nível:
  - **Categoria** → campo de busca + lista das `rootCategories` + "Todas" + "Sem categoria".
  - **Fornecedor** → campo de busca + lista de `suppliers` + "Todos".
  - **Cliente** → campo de busca + lista de `clients` + "Todos".
- Selecionar uma opção aplica o filtro (chama `onFiltersChange`) e volta para a tela de níveis (não fecha o popover, para permitir combinar).
- Cada nível mostra chip do valor selecionado com "×" para limpar rapidamente sem entrar no submenu.
- Fechar popover confirma; estado é sempre o `filters` do pai (sem estado intermediário).

Comportamento visual inspirado no Google Ads: nível → drilldown → lista com busca, com "Aplicar" implícito (seleção já aplica).

### 3. Layout
- Ordem final da barra (esquerda → direita):
  `[Busca] [Tipo toggle] [Conciliação toggle] [Ordenação] [Filtrar por ▾] [Conta/Carteira]`
- Remove os três `Select` separados (Categoria, Fornecedor, Cliente) — todos ficam dentro do "Filtrar por".
- Mantém `flex-wrap` para responsividade; a barra fica bem mais curta.

## Fora de escopo
- Lógica de filtragem, hooks (`useTransactions`), tabela, imports, layout global, Supabase.
- Sub-cartões e o filtro Conta/Carteira permanecem como estão.
