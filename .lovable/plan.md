## Diagnóstico

A lista de categorias nos seletores em cascata (`CategoryCascadeSelect` e o helper `getSubsOf` de `ReconcileStep`) é resolvida **por nome de pai**, não por ID:

- `CategoryCascadeSelect.tsx` (linhas 94–108): `subsFor(parentName)` faz `rootList.find(r => r.name === parentName)` e depois `byParent.get(parent.id)`. Se dois registros compartilham o mesmo `name` (colisão comum: subcategoria homônima em ramos diferentes, ou raízes duplicadas), `find` retorna só o primeiro e o restante da subárvore some do dropdown.
- `ReconcileStep.tsx` (linha 544): `categories.find(c => c.name === parentName)` tem o mesmo problema para calcular subs a partir de uma raiz.
- Efeito colateral: ao alternar entre linhas ou avançar/voltar de step, o `useMemo` remonta e resolve novamente o pai por nome; qualquer colisão faz a subcategoria "sumir" mesmo com os dados carregados corretamente em `categoryBase`.

Não há problema de fetch — `categoryBase` continua com todas as categorias do contexto. O bug é puramente de **resolução por nome vs ID** dentro dos seletores.

Além disso, `mergedCategories` é recalculado a cada render do modal (dependências estáveis, ok), mas o valor selecionado em cada linha (`RowCategoryValue`) guarda apenas nomes. Isso significa que qualquer navegação futura tem que re-resolver pai por nome — perpetuando o bug.

## O que fazer

1. **Resolver pais por ID no `CategoryCascadeSelect`**
   - Manter a exibição por nome, mas internamente construir um índice `byId` e usar o **ID do pai selecionado** para buscar filhos.
   - Como o valor atual (`RowCategoryValue`) só armazena nomes, resolver o ID a partir do nome de forma determinística: ao clicar em uma raiz/sub, capturar o ID do item clicado e usá-lo na próxima consulta (`useMemo` derivado do valor + índice completo). Em caso de nomes duplicados na mesma camada, preferir o item cuja cadeia `category → sub → sub2` seja consistente.
   - Adicionar `parentId` opcional em memória interna (não persistir no valor) para não quebrar consumidores externos do tipo `RowCategoryValue`.

2. **Corrigir `getSubsOf` em `ReconcileStep.tsx`**
   - Trocar `categories.find(c => c.name === parentName)` por lookup por ID. Preferir uma versão que aceite o `id` do pai; enquanto o valor da linha só tem nome, resolver com o mesmo utilitário do item 1 (função compartilhada `resolveCategoryChain(names, categories) => { rootId, subId, sub2Id }`).

3. **Utilitário compartilhado**
   - Criar `src/lib/categoryChain.ts` com:
     - `buildCategoryIndex(categories)` → `{ byId, byParent }`.
     - `resolveChain({ category, subcategory, subcategory2 }, index)` → retorna a tupla de IDs, priorizando cadeias válidas em caso de nomes duplicados (varrer todas as raízes com o nome pedido e escolher a que possui filho com o nome da sub, e assim por diante).
     - Usar esse utilitário tanto no cascade selector quanto no `ReconcileStep`.

4. **Garantir estabilidade ao trocar linha/step**
   - `CategoryCascadeSelect` deve derivar suas listas exclusivamente do índice + valor atual (sem depender de estado interno que se perde ao remontar).
   - `mergedCategories` já é memoizado; adicionar o índice como `useMemo` no `ImportStatementModal` e passar tanto `categories` quanto `categoryIndex` como props para evitar recomputar em cada popover.

5. **Categorias criadas inline continuam refletindo imediatamente**
   - Manter o merge `categoryBase + extraCategories`. Como o índice é derivado, novas categorias aparecem em todas as linhas na hora — nenhum reset extra necessário.

## Detalhes técnicos

- Arquivos alterados:
  - `src/components/lancamentos/import/CategoryCascadeSelect.tsx` — resolver pai por ID via índice, remover `roots.find(r => r.name === parentName)`.
  - `src/components/lancamentos/import/ReconcileStep.tsx` — usar `resolveChain`/índice em vez de `find` por nome.
  - `src/components/lancamentos/ImportStatementModal.tsx` — construir e passar o `categoryIndex` memoizado; nada muda no fetch.
  - Novo: `src/lib/categoryChain.ts` — index + resolvedor de cadeia.
- Sem migração de banco, sem mudança de contrato de `RowCategoryValue`.
- Sem alteração no fluxo de hooks/data — `useTransactions` continua igual.

## Verificação

- Abrir importação em conta com categorias que compartilham nome entre ramos diferentes; confirmar que a subárvore inteira aparece após selecionar raiz.
- Trocar de linha e voltar; garantir que subs e sub-subs continuam visíveis.
- Avançar `preview → reconcile → summary → voltar` e confirmar que cada linha ainda mostra as opções esperadas.
- Criar nova categoria inline e conferir que aparece nas demais linhas sem refresh.
