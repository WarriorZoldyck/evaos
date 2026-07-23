
## Diagnóstico

Verifiquei os dados do usuário `espclin@hotmail.com` (id `b049592f-...`): ele tem **2.010 lançamentos já categorizados** (655 só de cartão). Ou seja, o histórico existe — mas nada dele é aproveitado na hora de importar o próximo extrato.

O motivo está em `src/hooks/useCategorySuggestions.ts` (Estágio 1 — "history match"):

```ts
const validCatNames = new Set(categories.map((c) => c.name));
...
if (!h.category || !validCatNames.has(h.category)) return;
```

O código assume que `transactions.category / subcategory / subcategory2` guardam **nomes** de categoria. Mas hoje, para esse usuário (e para o fluxo novo), esses campos guardam **UUIDs** (a consulta mostrou `category: 100944ed-16c4-...`, `subcategory: 8b96b5b7-...`, etc.).

Consequências:
- O filtro `validCatNames.has(h.category)` **descarta 100% do histórico** → o índice de tokens fica vazio → nenhuma linha é resolvida por histórico.
- Todas as ~135 linhas caem no Estágio 2 (IA). Com esse volume, a IA frequentemente devolve pouco ou nada em tempo hábil, e o resultado é o que aparece no print: tudo "Sem categoria".
- Mesmo quando havia um lançamento equivalente no sistema (seed via `matches` no `ImportStatementModal`), o candidato traz `category` em UUID e o `resolveCategoryPath` (que resolve por nome) devolve só o próprio UUID como "category" solto, sem preencher sub/sub2 corretamente em alguns caminhos.

## Correção

Trabalhar só no frontend (nenhuma mudança de dados). Dois arquivos:

### 1. `src/hooks/useCategorySuggestions.ts`
- Construir dois lookups a partir de `categories`: `byId` (UUID→objeto) e `byName` (nome→objeto).
- Normalizador `toName(v)`: se `v` for UUID conhecido, devolve o nome; se for nome válido, devolve como está; senão `null`.
- Ao ler o histórico, converter `h.category / h.subcategory / h.subcategory2` via `toName` **antes** de indexar. Descartar apenas quando `toName(h.category)` for nulo.
- Manter o resto do algoritmo igual (tokenização, score por trio, escolha do leaf mais profundo). O retorno continua sendo o **nome do leaf**, para o `resolveCategoryPath` do caller expandir os 3 níveis.

### 2. `src/components/lancamentos/ImportStatementModal.tsx` (seed a partir de `matches`)
- No `useEffect` que semeia `rowCategories` a partir de `matches` (linhas ~851-875), normalizar `cand.category / subcategory / subcategory2` de UUID para nome antes de chamar `resolveCategoryPath` — assim a hierarquia (categoria → sub → sub-sub) é reconstruída corretamente e depois convertida de volta para UUID no submit por `resolveCategoryName`.

Não mexer no Estágio 2 (IA) nem no edge function — ele já opera por nome.

## Detalhes técnicos

- Nada de mudança em schema, migração ou edge function.
- `resolveCategoryPath(name, categories)` já existe em `ImportStatementModal.tsx` e faz o walk pelo `parent_id`. Vamos reutilizá-lo.
- Preservar o gate atual "≥ 2 token matches" para não regredir precisão.
- Continuar respeitando `next[idx]?.touched` para nunca sobrescrever escolha manual do usuário.

## Verificação após aplicar

1. Reimportar o extrato do print (135 linhas). Esperado: linhas recorrentes ("PAO DE QUEIJO", "HIPER MORAES", "DROGASTORE FILIAL", etc.) que já foram categorizadas em faturas anteriores aparecerem já com categoria preenchida (badge/estilo de sugestão), sem exigir toque manual.
2. Contador no rodapé "0 conciliar · 135 criar" deve continuar correto — o fix é só de categoria, não altera matching.
3. Onde não há histórico, o Estágio 2 (IA) continua tentando preencher — comportamento inalterado.
