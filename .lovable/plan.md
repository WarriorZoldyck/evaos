
## Objetivo

Garantir que o `CategoryCascadeSelect` da tela de importação de extrato exiba **todas** as categorias, subcategorias e sub-subcategorias disponíveis para cada linha, sem itens "sumindo" por conflitos de contexto ou de `type`.

## Diagnóstico (verificado nos arquivos)

Fluxo atual das categorias na importação:

```text
useTransactions → allCategories (todos os contextos, sem filtro de empresa)
      │
      ▼
Lancamentos.tsx / ImportarExtrato.tsx → <ImportStatementModal allCategories={...} />
      │
      ▼
ImportStatementModal → mergedCategories (= allCategories + criadas localmente)
      │
      ▼
ReconcileStep → <CategoryCascadeSelect categories={mergedCategories} type={row.type} />
```

Dois pontos frágeis identificados que explicam "não aparecem todas":

1. **Colisão de nomes entre contextos (Pessoal × Empresa).** Como `allCategories` contém as duas árvores concatenadas, dentro do `CategoryCascadeSelect` a busca de pai é feita por **nome** (`rootList.find(r => r.name === parentName)`). Quando existe uma raiz "Alimentação" em Pessoal **e** em Empresa, apenas a primeira encontrada tem seus filhos exibidos — as subcategorias da outra árvore ficam invisíveis mesmo estando no array.

2. **Filtro por `type` esconde filhos legítimos.** `typeAllows` só aceita categorias com `type` nulo, `ambos` ou igual ao da linha. Em cartão de crédito quase toda linha é `despesa`; se uma subcategoria estiver marcada como `receita` (comum em cadastros antigos) ela some, mesmo o usuário querendo usá‑la para um estorno. A raiz pode passar e os filhos não, deixando o segundo/terceiro nível vazio.

## Plano de verificação (sem alterar código ainda)

1. Rodar um `SELECT` em `categories` para o usuário afetado, agrupando por `(name, parent_id)`, para confirmar quantos nomes de raiz colidem entre contextos.
2. Contar filhos por raiz e comparar com o que o componente exibe (via console log temporário em `CategoryCascadeSelect` mostrando `roots.length`, `subs.length`, `sub2s.length` para uma linha).
3. Confirmar quantas categorias têm `type` diferente do esperado para a linha (`despesa` × `receita`).

## Correções propostas

Alterações restritas ao fluxo de importação; não muda o comportamento da tela principal de lançamentos.

1. **Escopo por contexto ativo no seletor da importação.**
   - Em `ImportStatementModal.tsx`, filtrar `mergedCategories` pelo contexto atual (`selectedCompanyId` — `null` = Pessoal) antes de passar para `ReconcileStep`. Assim a árvore mostrada é exatamente a do contexto onde a fatura será importada, eliminando a colisão de nomes.
   - Manter o `allCategories` completo apenas para resolver **nomes** em sugestões históricas (`resolveCategoryName`), não para popular o seletor.

2. **Resolver pai por `id`, não por `name`, no `CategoryCascadeSelect`.**
   - Trocar o `RowCategoryValue` interno do seletor para carregar também `categoryId` / `subcategoryId` quando disponíveis, ou reescrever o `useMemo` para agrupar por `parent_id` e mapear o pai selecionado pelo `id` da raiz escolhida (armazenando o id no estado local do select). Isso torna a cascata robusta mesmo se voltarmos a permitir múltiplos contextos.

3. **Afrouxar o filtro por `type` no contexto da importação.**
   - Em `CategoryCascadeSelect`, tornar o filtro `typeAllows` opcional via prop `strictType` (default `false` na importação, `true` em telas onde o tipo deve ser respeitado). Assim toda categoria do contexto aparece, e o usuário decide.
   - Alternativa mais conservadora: manter o filtro apenas no primeiro nível (raiz) e mostrar todos os filhos, já que sub/sub2 herdam a raiz na prática.

4. **Log de sanidade temporário** (removido após validação): imprimir uma vez, na abertura do modal, os totais `roots/subs/sub2s` visíveis para a primeira linha, para confirmar in‑vivo que o número bate com o banco.

## Validação

- Typecheck do projeto.
- Abrir `/lancamentos/importar-extrato` em uma conta com categorias em Pessoal e Empresa; verificar que a árvore mostrada corresponde ao contexto selecionado e inclui todas as sub/sub2.
- Selecionar uma linha `despesa` cuja subcategoria histórica seja `receita` e confirmar que ela agora aparece.
- Criar categoria inline em cada um dos três níveis e confirmar que aparece imediatamente no dropdown.

## Detalhes técnicos

- Arquivos afetados: `src/components/lancamentos/ImportStatementModal.tsx`, `src/components/lancamentos/import/CategoryCascadeSelect.tsx`, `src/components/lancamentos/import/ReconcileStep.tsx` (apenas se precisar propagar nova prop `strictType`).
- Sem migração de banco.
- Sem mudanças nos demais consumidores de `CategoryPathCombobox` / `CategoryCascadeSelect` fora da importação.
