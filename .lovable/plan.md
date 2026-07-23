
## Diagnóstico

Na Stage 2 do import (`ReconcileStep.tsx`, linhas ~870-960) cada linha tem **3 selects lado a lado** (Categoria / Subcategoria / Subcategoria²) usando `Select` do shadcn (Radix). Problemas reais que o screenshot mostra:

- O `SelectContent` do Radix é portalado no `<body>`, mas dentro de um `Dialog` com `max-h-[90vh]` + lista de dropdown longa, o painel abre sobre as próximas linhas, cortando visualmente as opções e sem indicação clara de que rola.
- Não há busca. Com 20-50 categorias, o usuário precisa scrollar dentro de um popover pequeno pra achar uma. Em resoluções médias, o painel cabe uns 6 itens e o resto some.
- Ter 3 campos por linha ocupa muito espaço horizontal — os selects ficam estreitos, o texto da categoria trunca, e abrir subcategoria depende de já ter escolhido categoria (fluxo de 3 cliques).
- Quando o usuário rola a lista do modal com o dropdown aberto, o portal não acompanha e some/desalinha.

## Solução

Substituir os 3 selects por **um único combobox hierárquico com busca**, no mesmo espírito do `UnifiedEntityFilter` que você aprovou. Um clique → popover com input de busca no topo → lista de caminhos completos (`Alimentação › Restaurante › Almoço`) navegável e pesquisável.

### Novo componente: `CategoryPathCombobox`

Arquivo novo: `src/components/lancamentos/CategoryPathCombobox.tsx`.

- Baseado em `Popover` + `Command` (`CommandInput` / `CommandList` / `CommandItem` / `CommandEmpty`) do shadcn — mesmo stack do `UnifiedEntityFilter`.
- Recebe `categories` (flat com `parent_id`) e `type` (receita/despesa) para filtrar.
- Monta internamente todos os caminhos possíveis (raiz, raiz›sub, raiz›sub›sub²) filtrando pelo `type`.
- Trigger: botão do tamanho de um input (`h-8`), mostra o caminho selecionado com separadores `›` e placeholder "Selecionar categoria". Ícone de chevron.
- Popover: `align="start"` `sideOffset={4}` `className="w-[360px] p-0"`, `PopoverContent` já é portalado — não sofre com clipping do modal.
- Command:
  - `CommandInput` com `placeholder="Buscar categoria…"` — fuzzy match por texto do caminho inteiro (o `Command` do shadcn já faz isso).
  - `CommandList` com `className="max-h-[280px]"` — scroll interno explícito.
  - `CommandEmpty`: "Nenhuma categoria. [+ Criar nova]" — se `onCreateCategory` existir, botão inline pra criar no nome digitado (usa o texto do input como sugestão).
  - `CommandItem` por caminho: mostra o caminho hierárquico completo, com a folha em negrito e ancestrais em `text-muted-foreground`. Ao selecionar, chama `onChange({ category, subcategory, subcategory2 })` e fecha o popover.
  - Item fixo no rodapé: "**+ Criar nova categoria**" que abre um pequeno inline form (input + botão) dentro do próprio popover para criar na raiz — reaproveita `onCreateCategory` já existente.
- Um botão pequeno "Limpar" no rodapé zera pra "Sem categoria".

### Integração no `ReconcileStep`

- Trecho linhas ~870-960: substituir o bloco dos 3 `<Select>` por **um** `<CategoryPathCombobox ... />`.
- Remove a lógica de derivar `subs` / `subSubs` inline por linha — o combobox faz isso.
- `createCatState` continua sendo usado como fallback: o combobox chama `onCreateCategory` diretamente quando disponível; sem ele, cai no diálogo antigo (para compatibilidade).
- Nas colunas do grid da linha (linha ~830 aproximadamente), o slot que hoje comporta 3 selects vira 1 campo — dá pra reduzir a largura da coluna e o texto da descrição respira mais.

### Nada mais muda

- `useCategorySuggestions` e o overlay de loading não são tocados.
- Preview/lógica de conciliação, ações "Vincular/Criar/Ignorar", orphans, tudo intacto.
- `CategorySelectWithCreate.tsx` fica no repositório (é usado no `TransactionFormModal`); mudança é local ao fluxo de import.

## Detalhes técnicos

- Filtro por `type`: uma categoria participa dos caminhos se `type === row.type` ou `type === 'ambos'` ou `type === null`. Subcategorias herdam via `parent_id`.
- Construção dos paths: DFS a partir das raízes, gera `{ path: string[], leafId, leafName, categoryName, subcategoryName?, subcategory2Name? }` — memoizado por `[categories, type]`.
- Match visual da sugestão da IA: quando `rowCategories[i].touched` for `false` e houver `suggestions[i]`, o trigger mostra um pequeno badge `Sparkles` do lado (mantém o padrão atual).
- Sem dependência nova: `Command` já está instalado (é usado no `UnifiedEntityFilter`).

## Verificação

- Abrir import de cartão com >30 categorias, abrir o combobox numa linha do meio da lista, rolar o modal — o popover deve permanecer ancorado corretamente ou fechar (comportamento nativo do Radix Popover é aceitável).
- Digitar "resta" deve filtrar para "Alimentação › Restaurante".
- Selecionar limpa "Sem categoria" e fecha.
- Botão "+ Criar nova" no rodapé cria raiz e já a seleciona.
