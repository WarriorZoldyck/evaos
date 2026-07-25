
## Contexto

No vídeo do usuário `simoespaula`, a seção **"Só no sistema"** lista itens que também aparecem no extrato (badge "Mesmo valor no extrato — pode ser o mesmo lançamento com data errada"). Ex.: `AMAZONPRIMEBR R$ 19,90` e `APPLE COM/BILL R$ 19,90` aparecem no extrato E como órfãos do sistema, mas continuam separados nas duas listas — parecendo bug.

## Causa

O passe automático em `ImportStatementModal.tsx` (linhas 856–954) que promove órfão → sugestão de vínculo só age quando é **estritamente 1↔1 por valor**:

```ts
if (orphList.length !== 1 || lineIdxs.length !== 1) return; // só 1↔1
```

Quando há 2 órfãos AMAZONPRIMEBR de R$19,90 e 2 linhas do extrato AMAZONPRIMEBR de R$19,90, o passe desiste e mantém tudo separado. Como o extrato é a fonte da verdade e a descrição é praticamente idêntica, essas M↔N deveriam ser pareadas.

## Mudança

Editar apenas o `useEffect` de auto-pareamento em `src/components/lancamentos/ImportStatementModal.tsx` (856–954). Nenhuma alteração de backend, schema ou lógica de importação/matching principal.

Novo algoritmo por valor (em centavos):

1. Coletar órfãos e linhas não-matcheadas (`ação = criar`, sem `best`/`extraMatches`) desse valor.
2. Caso 1↔1 → parear (comportamento atual, preservado).
3. Caso M↔N (M,N ≥ 1):
   - Normalizar descrições (mesma normalização já usada em `lib/import/matching.ts`).
   - Para cada linha, computar `descriptionSimilarity` contra cada órfão do mesmo valor.
   - Casar de forma gulosa em ordem decrescente de similaridade, exigindo `similarity ≥ AUTO_LINK_MIN_SIMILARITY` OU token compartilhado significativo (mesma regra de `pickBestMatch`).
   - Pares aceitos viram `extraMatches`/`vincular` e o órfão sai da lista "Só no sistema" (via `promotedOrphanIds` e `setOrphans`).
   - Órfãos/linhas que não acharam par ficam onde estão para revisão manual.
4. Manter `suggested: true` para que a UI mostre como "sugerido — confirmar", não como conciliação silenciosa.

## Fora de escopo

- Não mexer em `useCategorySuggestions`, `parse-bank-statement` nem no webhook.
- Não alterar categorização — apenas o pareamento visual/estado.
- Não mudar a UI da seção "Só no sistema" além da consequência natural (itens promovidos somem da lista, como já ocorre no fluxo 1↔1).

## Validação

- Reimportar o mesmo extrato do vídeo: `AMAZONPRIMEBR` e `APPLE COM/BILL` de R$19,90 devem sair de "Só no sistema" e aparecer como linhas com sugestão "É o mesmo" pré-selecionada.
- Casos onde a descrição diverge (ex.: valor igual mas nomes sem overlap) permanecem em "Só no sistema" — evita colisões cegas.
