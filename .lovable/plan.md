## Objetivo
Permitir criar categoria, subcategoria e sub-sub direto no seletor da etapa "Conciliar & Categorizar" da importação, sem sair do modal.

## Mudanças

**1. `src/components/lancamentos/import/ReconcileStep.tsx`**
- Em cada um dos três `Select` de categoria (raiz, sub, sub-sub) da tabela de "novos lançamentos", adicionar item extra `+ Criar nova` (padrão visual do `CategorySelectWithCreate.tsx`).
- Ao escolher `+ Criar nova`, abrir um pequeno `Dialog` inline pedindo o nome. Ao confirmar:
  - Chamar `onCreateCategory({ name, parent_id, type })` (nova prop) — onde `parent_id` é derivado do nível (null na raiz, id da categoria pai na sub, id da sub na sub-sub) e `type` é `r.type` da linha.
  - Após criação, aplicar o novo nome no `rowCategories[i]` no nível correspondente (marcando `touched: true`) para que o Select já mostre selecionado.

**2. `src/components/lancamentos/ImportStatementModal.tsx`**
- Receber (ou consumir via `useCategories`) `createCategory` + `refetch` e passar como `onCreateCategory` para `ReconcileStep`.
- O handler faz `createCategory({ name, parent_id, type })`, aguarda `refetch()` para que a lista `categories` já contenha o novo id na próxima renderização, e retorna o registro criado (name + id) para o ReconcileStep aplicar a seleção.

**3. Contexto/escopo**
- A criação respeita o contexto atual (Pessoal/Empresa) porque `useCategories` já filtra por `effectiveUserId` + `company_id` do contexto ativo.
- Type: na raiz usa `r.type` (`receita`/`despesa`); em sub/sub-sub fica `undefined` (herda "ambos"), igual ao comportamento do `CategoryFormModal`.

## Não muda
- Fluxo de conciliação, sugestões da IA, ações "vincular/criar/ignorar", nem qualquer outra tela.
- Estrutura de `RowCategoryValue` (continua sendo por nome).