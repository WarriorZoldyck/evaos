
## Problema

O `CategoryPathCombobox` está listando de uma vez **todos os caminhos possíveis** (categoria, sub, sub-sub) — o resultado é uma lista longa e poluída, com muitas linhas repetindo o mesmo pai. O usuário quer voltar à experiência anterior: mostrar só o nível atual e ir abrindo os filhos conforme clica, como um menu em cascata (bonito e funcional).

## Objetivo

Manter o combobox único (unificado, com portal, criação inline — nada disso muda), mas mudar a **forma de renderizar as opções**:

- Estado **navegação** (padrão, sem busca): mostrar só o nível atual.
  - Nível 0: lista das categorias raiz.
  - Ao clicar numa categoria com filhos: entra no nível 1 (subcategorias daquela categoria) com um cabeçalho de breadcrumb + botão "voltar".
  - Idem para nível 2.
  - Cada item com filhos tem um chevron `›` à direita indicando drill-down.
  - Cada item pode ser **selecionado** clicando na área do label (ou num pequeno "Usar este nível" quando houver filhos), para permitir escolher só a categoria pai sem descer.
- Estado **busca** (usuário digitou no input): aí sim mostrar a lista achatada de caminhos completos (como está hoje), para encontrar rapidamente por texto. Volta pra navegação quando a busca é limpa.

## Comportamento

- "Sem categoria" e o rodapé de criação (`+ Nova categoria`, `+ Sub em "X"`, `+ Sub-sub em "Y"`) continuam disponíveis em todos os níveis; o botão de "Sub em" usa o contexto do nível atual em que o usuário está navegando (não só o `value` selecionado).
- Ao selecionar um item folha, fecha o popover como hoje.
- Ao selecionar um item que tem filhos: por padrão **entra no nível** (drill-down). Um botão/atalho separado permite escolhê-lo como valor final sem descer.
- Ao reabrir o popover, se já houver `value`, iniciar a navegação já posicionada no nível do valor selecionado (ex.: valor = `Alimentação > Restaurante` → abrir mostrando as subs de `Alimentação` com `Restaurante` marcado).
- Tipo (`receita`/`despesa`) continua filtrando raízes como hoje.

## Arquivos afetados

- `src/components/lancamentos/CategoryPathCombobox.tsx` — única alteração. Refatorar a renderização interna do `Command`:
  - Novo estado `navPath: string[]` (nomes do caminho atual, vazio = raiz).
  - Derivar `currentChildren` a partir do mapa `byParent` já existente.
  - Renderizar cabeçalho com breadcrumb + botão `← Voltar` quando `navPath.length > 0`.
  - Quando `query` está vazio: renderizar `currentChildren`.
  - Quando `query` tem texto: renderizar `paths` achatado (comportamento atual) para busca global.
  - Manter `CommandInput`, `CommandEmpty`, criação inline e "Sem categoria".

Nenhuma mudança em outros componentes, hooks, ou lógica de sugestão/histórico.
