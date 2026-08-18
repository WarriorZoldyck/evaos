---
name: Persistência das decisões na conciliação
description: Decisões do usuário na importação/conciliação nunca podem ser sobrescritas pelo motor de matching
type: feature
---
Na tela de importação/conciliação (`ImportStatementModal` + `ReconcileStep`):

- `src/lib/import/disposition.ts` é a fonte ÚNICA da decisão da linha. Nunca usar `matchActions[i] || "criar"` na tela e `|| "ignorar"` no commit — essa divergência fazia linhas confirmadas sumirem da importação.
- Linha com selo "Confirmada" (`reviewedRows`) sem ação registrada conta como **criar**.
- O recálculo do matcher (`applyMatchDefaults`) só define ação para linhas ainda não decididas; `userDecidedRows` (espelhado em `decidedRowsRef`) protege o restante. Toda interação do usuário chama `markDecided(idx)`.
- Ao retomar rascunho, `reviewedRows` faz backfill de `matchActions` e tudo do snapshot entra em `userDecidedRows`.
- Rascunho grava imediatamente quando muda uma decisão (debounce 400 ms só para texto) e mostra "Progresso salvo às HH:MM".
- Importação é bloqueada se existir linha confirmada na tela que não entraria no lote.
