## Diagnóstico

O botão "É o mesmo" existe em **3 locais** de `ReconcileStep.tsx` com comportamentos ligeiramente diferentes:

1. **Linha 589-606** — seção "Correspondências prováveis" (com match do matcher). Faz `onTargetChange(i, cand.id)` + `onActionChange(i, "vincular")`. Funciona: cai em `matchedToleranceRows`.
2. **Linha 964-974** — seção "Provável" (matcher achou candidato com descrição diferente / suggested). Mesma dupla de chamadas. Deveria funcionar, mas o filtro `suggestedRows` só remove a linha se `dismissedSuggestions` for atualizado *ou* se a ação sair de `"criar"`. Como muda para `vincular`, sai. **OK em teoria — verificar em runtime.**
3. **Linha 1374-1392** — seção "Só no sistema" (orphans com valor idêntico no extrato). Faz `onTargetChange(i, o.id)` + `onActionChange(i, "vincular")`, mas **`matches[i]?.best` continua nulo** para essa linha do extrato. Consequência:
   - Filtros `matchedExactRows` / `matchedToleranceRows` exigem `matches[i]?.best` e ignoram a linha.
   - Filtro `newRows` mantém a linha (`action === "vincular" && !matches[i]?.best`).
   - Visualmente: a linha continua em "Só no extrato" **e** o órfão continua em "Só no sistema" (o órfão não some porque `orphans` vem do backend, não é derivado de matchActions).
   - O total `reconciledRowsTotal` já conta essa linha corretamente e o handler `ImportStatementModal` (linha 1192) faz o link no submit — mas o usuário **não vê feedback** e o card do órfão continua parecendo não vinculado.

## Mudanças

### `src/components/lancamentos/import/ReconcileStep.tsx`

**1. Unificar o handler "É o mesmo" em um helper**
No topo do componente, criar:
```ts
const handleMarkSame = (rowIdx: number, targetTxId: string) => {
  onTargetChange(rowIdx, targetTxId);
  onActionChange(rowIdx, "vincular");
  setDismissedSuggestions((prev) => {
    const next = new Set(prev);
    next.add(rowIdx);
    return next;
  });
  setLinkedOrphans((prev) => new Set(prev).add(targetTxId));
};
```
Substituir os 3 `onClick` inline (linhas 595-598, 968-971, 1381-1384) por `handleMarkSame(i, ...)`.

**2. Rastrear órfãos vinculados manualmente**
Adicionar estado `const [linkedOrphans, setLinkedOrphans] = useState<Set<string>>(new Set());`.

Na seção "Só no sistema" (~linha 1300), filtrar `orphans.filter(o => !linkedOrphans.has(o.id))` para que o card do lançamento suma da lista após "É o mesmo".

**3. Considerar linhas vinculadas manualmente como matched na UI**
Ajustar os filtros (`matchedToleranceRows` e `newRows`) para tratar linhas com `action === "vincular"` + `matchTargets[i]` como conciliadas, mesmo sem `matches[i]?.best`. Uma opção mínima: adicionar uma quarta lista `manualLinkedRows` e exibi-la dentro de "Correspondências prováveis", e excluí-la de `newRows` via `manualLinkedIdxSet`.

**4. Feedback imediato**
Adicionar `toast.success("Vinculado — será marcado como conciliado ao importar")` no `handleMarkSame`.

## Fora do escopo
- Fluxo de "Criar novo" / `ReviewNewEntryModal` / toggle neumórfico.
- Design da sidebar / EVA Design System.
- Lógica de matching automática (`useImportMatching`).
- Handler de submit em `ImportStatementModal` (já processa `vincular` corretamente).

## Verificação
- Seção "Correspondências prováveis": clicar "É o mesmo" → linha continua verde, contador "conciliar" incrementa.
- Seção "Provável": clicar "É o mesmo" → linha sai da lista amarela e aparece em conciliadas.
- Seção "Só no sistema": clicar "É o mesmo" em uma linha do extrato com mesmo valor → o card do órfão some, a linha do extrato entra em conciliadas, toast confirma.
- Confirmar no submit: `matchActions[i] === "vincular"` + `matchTargets[i]` gera update com `is_reconciled: true` (log já existente).
