## Objetivo
1. Fixar as tabs "Todos / Realizado / Projetado" também na rolagem (sticky), logo abaixo da barra de filtros já sticky.
2. Aplicar o mesmo fundo cinza (estilo `TabsList`) nos toggle groups "Tudo / Entradas / Saídas" e "Todos / Conciliados / Sem conciliação", para indicar visualmente que são grupos de opções.

## Alterações

### `src/pages/Lancamentos.tsx`
- Retirar o `<Tabs>` de dentro do `<Card>` e colocá-lo em um wrapper próprio `sticky top-[Xpx] z-40` (ou usar o mesmo pattern do bar de filtros: `-mx-4 md:-mx-6 px-4 md:px-6`, `bg-card`, `border-b`), imediatamente após a barra sticky de filtros.
- Ajustar o offset `top` para que essa barra fique colada abaixo da barra de filtros existente (medir a altura ~56–60px; usar `top-[56px]` ou similar).
- Manter o `Card` do conteúdo abaixo (sem as tabs dentro), com `rounded-t-none border-t-0` para continuar visualmente conectado.
- O `activeTab`/`handleTabChange` continua controlando o valor, apenas renderizado fora do Card.

### `src/components/lancamentos/TransactionFilters.tsx`
- Envolver o `ToggleGroup` de **Tipo** (Tudo / Entradas / Saídas) num container com as mesmas classes visuais que o `TabsList` do shadcn usa: `bg-muted rounded-md p-1` — e ajustar os `ToggleGroupItem` para `data-[state=on]:bg-background data-[state=on]:shadow-sm` (idêntico ao `TabsTrigger`), sem bordas externas.
- Mesmo tratamento no `ToggleGroup` de **Conciliação** (Todos / Conciliados / Sem conciliação).
- Não alterar lógica de filtros, nem os demais controles (Ordenação, "Filtrar por", Conta/Carteira).

## Fora de escopo
- Layout do header global, filtros de período/busca, `UnifiedEntityFilter`, dados, hooks, tabela.
