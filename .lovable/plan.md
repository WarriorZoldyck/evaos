## Objetivo
Voltar, no fluxo de importação de extrato (Análises EVA), ao seletor de categoria em **3 campos em cascata** — Categoria → Subcategoria → Sub-subcategoria — como já existe no formulário de lançamento. O combobox atual (drilldown com popover) está sendo percebido como incompleto e menos claro para descer níveis.

## Onde alterar
Somente componentes do fluxo de importação — nada muda no formulário de lançamento nem em outros lugares:

- `src/components/lancamentos/import/ReconcileStep.tsx`
  - Substituir os 3 usos de `CategoryPathCombobox` (linhas ~294, ~1277, ~1356) por um novo componente cascade em coluna.
  - Locais afetados:
    1. Painel `InlineReviewRow` (revisão inline "Criar novo").
    2. Célula "Categoria" da tabela de novos lançamentos.
    3. `InlineReviewRow` embutida na tabela (mesmo componente do item 1, alcançado via render).

- Novo componente: `src/components/lancamentos/import/CategoryCascadeSelect.tsx`
  - Reutiliza `CategorySelectWithCreate` (mesmo componente do form principal), montando os 3 selects em cascata.
  - Props idênticas às usadas hoje pelo `CategoryPathCombobox` no import: `categories`, `value`, `type`, `onChange`, `onCreateCategory`.
  - Internamente:
    - Deriva `rootCategories`, `subCategories(parentId)`, `subSubCategories(parentId)` a partir da mesma lista `mergedCategories` já passada.
    - Filtra respeitando `type` (receita/despesa/ambos), como o combobox faz hoje.
    - Ao trocar categoria pai, zera os filhos.
    - Cria categoria via `onCreateCategory({ name, parentName, type })` — assinatura já existente.
  - Layout: `grid grid-cols-3 gap-2` na coluna da tabela; no `InlineReviewRow` mantém o mesmo grid já usado.

## O que NÃO muda
- `CategoryPathCombobox.tsx` permanece no repo (usado apenas aqui — pode ser removido depois, mas fica como fallback nesta iteração).
- Formulário de lançamento (`TransactionFormModal.tsx`) fica intocado.
- Lógica de sugestão histórica (`SuggestionWhyPopover`, hook `useCategorySuggestions`) e de matching não muda.
- `mergedCategories` continua sendo a fonte (já contém todas as categorias, incluindo cross-context via `allCategories`).

## Racional
- O usuário confirma que "descer a níveis sub e sub da sub era melhor no seletor" — o padrão de 3 selects já existe no app e é o mesmo que ele usa ao criar lançamento manualmente, então a familiaridade e a visibilidade dos níveis voltam.
- Ao reaproveitar `CategorySelectWithCreate` a criação inline de categoria/subcategoria continua funcionando sem regressão.
