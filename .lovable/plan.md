## Diagnóstico confirmado

Ao ler `useCategories.ts` vi que ele filtra as categorias por contexto (`isPersonal` → `company_id IS NULL`; senão `company_id = selectedCompanyId`). Já `useCategorySuggestions.ts` recebe essa lista filtrada como único dicionário para converter UUID→nome:

```ts
const byId = new Map(categories.map((c) => [c.id, c]));
// ...
const toName = (v) => byId.get(v)?.name ?? byName.get(v) ?? v; // devolve o UUID cru
```

Consequência:
1. Se o lançamento histórico referencia uma categoria que **existe no banco mas em outro contexto** (ex.: usuário está em "Pessoal" mas categorizou antes em uma empresa, ou vice-versa), `byId` não encontra e a função devolve o UUID cru.
2. Esse UUID cru vai para `SuggestionSource.category / subcategory / subcategory2` e, em `ImportStatementModal`, o ramo `if (v.subcategory || v.subcategory2)` copia direto para `rowCategories` — daí os UUIDs aparecerem no input (print 1 e 2).
3. Como o `type` do lançamento histórico pode não bater com o filtro atual e o dicionário está incompleto, várias linhas nem aparecem casadas (INDITEX apareceu, mas L E M / DROGASIL / POSTO não, porque a categoria original foi resolvida como UUID e caiu como "sem histórico" ou foi descartada em camadas seguintes).

## O que fazer

### 1. Carregar TODAS as categorias do usuário no hook de sugestões
Dentro de `src/hooks/useCategorySuggestions.ts`, adicionar uma query paralela às amostras:

```ts
supabase
  .from("categories")
  .select("id, name, parent_id, type, company_id")
  .eq("user_id", effectiveUserId)   // isolamento total por usuário
```

Construir `byIdAll` / `byNameAll` a partir dessa lista (todos os contextos do próprio usuário). Usar esses mapas dentro de `toName` para converter UUIDs históricos em nomes reais, mesmo quando a categoria pertence a outro contexto (Pessoal ↔ Empresa).

Isso preserva o isolamento por `user_id` (nada de outros usuários entra no cruzamento) e resolve o problema de exibir UUIDs.

### 2. Fallback duro contra UUIDs vazando para a UI
Ainda no `toName`, se após todos os mapas o valor continuar com formato UUID (`/^[0-9a-f-]{36}$/i`), tratar como "sem nome resolvido" e descartar a amostra (não devolve UUID). Garantia de que o input nunca mais mostra UUID.

### 3. Melhorar `applyEntry` para não perder profundidade quando o contexto atual não tem a subcategoria
Já resolvido em passo anterior; só reconfirmar que `subcategory` / `subcategory2` vão preenchidos com os NOMES resolvidos (não IDs).

### 4. No `ImportStatementModal.tsx`
Ao aplicar a sugestão (linhas 843-852), quando `v.subcategory || v.subcategory2` estiver presente, chamar `resolveCategoryPath(v.subcategory2 || v.subcategory || v.category, categories)` para tentar reaproveitar a hierarquia atual (walk-up por `parent_id`). Se o `resolveCategoryPath` não achar nada no contexto atual, cair de volta para os nomes crus vindos da sugestão — assim o usuário vê nomes legíveis (ex.: "Beleza › Salão") em vez de UUIDs, mesmo se aquela árvore ainda não existir no contexto atual.

## Como testar

1. Reimportar o extrato do usuário `espclin@hotmail.com`.
2. Verificar que nenhum input mostra UUID — todos os campos exibem nomes reais ou "Selecionar categoria".
3. Conferir se `L E M ESCOVA E BELEZA`, `DROGASIL`, `BOMBOM`, `POSTO ...` aparecem categorizados de acordo com o histórico do próprio usuário (independente do contexto Pessoal/Empresa em que foram lançados originalmente).
4. O contador "X de Y do seu histórico" deve aumentar.

## Escopo intocado

- Não altero RLS nem tabelas.
- Não misturo dados entre usuários — a query permanece `eq("user_id", effectiveUserId)`.
- IA continua desligada.