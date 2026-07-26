
## Objetivo

Adicionar um campo de busca dentro de cada um dos três dropdowns do `CategoryCascadeSelect` (Categoria → Subcategoria → Sub‑subcategoria) para localizar itens rapidamente quando há muitas opções.

## Abordagem

Substituir os componentes `Select` (Radix) por um `Popover + Command` (cmdk / shadcn), que já traz `CommandInput` com filtro incremental, mantendo o mesmo layout de 3 colunas e o mesmo comportamento (limpar, criar novo, disabled em cascata).

Vantagens:
- `CommandInput` autofoca ao abrir, filtra por acento‑insensível via `normalize`.
- Já é padrão do projeto (mesmo componente usado em `CategoryPathCombobox`).
- Mantém o item "Nova categoria/subcategoria" no fim da lista com o mesmo fluxo de criação (`onCreateCategory` + `Dialog` de nome).

## Alterações

Arquivo único: `src/components/lancamentos/import/CategoryCascadeSelect.tsx`

Para cada um dos três níveis:

```text
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" role="combobox" className="h-8 text-xs justify-between">
      {selectedName || placeholder}
      <ChevronsUpDown …/>
    </Button>
  </PopoverTrigger>
  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
    <Command>
      <CommandInput placeholder="Buscar…" />
      <CommandList className="max-h-[280px]">
        <CommandEmpty>Nenhum resultado</CommandEmpty>
        <CommandGroup>
          {selected && <CommandItem onSelect={clear}>— limpar —</CommandItem>}
          {items.map(c => <CommandItem key={c.id} value={c.name} onSelect={…}>{c.name}</CommandItem>)}
        </CommandGroup>
        {onCreateCategory && (
          <CommandGroup>
            <CommandItem onSelect={openCreate}>+ Nova categoria</CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

Detalhes:
- Reaproveitar filtro do próprio `cmdk` (Command já filtra pelo `value` do item). Nomes normalizados via prop `filter` do `Command` para tratar acentos.
- Preservar props públicas atuais (`categories`, `value`, `type`, `onChange`, `onCreateCategory`, `strictType`, `className`) — nenhum chamador precisa mudar.
- Manter `Dialog` de criação de novo item como está.
- Botões dos níveis 2 e 3 permanecem `disabled` quando o nível anterior não estiver selecionado.
- Largura do popover ancorada ao trigger (`w-[--radix-popover-trigger-width]`) para casar visualmente com o grid de 3 colunas.

## Validação

- Typecheck.
- Abrir `/lancamentos/importar-extrato`, clicar no dropdown Categoria e digitar parte do nome com/sem acento.
- Selecionar uma raiz e conferir que Subcategoria também aceita busca; idem para o terceiro nível.
- Criar categoria nova em cada nível e conferir que aparece imediatamente selecionada.

## Escopo

Somente o componente `CategoryCascadeSelect`. Nenhuma mudança em `ReconcileStep`, no modal de importação, ou em outros consumidores.
