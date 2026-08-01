---
name: Modo Revisar Importação
description: Reabrir lançamentos já criados na tela de importação para recategorizar sem duplicar
type: feature
---
A tela `/lancamentos/importar-extrato` aceita o modo revisão via query string:
`?revisar=1&de=YYYY-MM-DD&ate=YYYY-MM-DD[&cartoes=id1,id2]` (filtro por `created_at` do lote, `ate` inclusivo).

- Carrega os lançamentos existentes como linhas do "extrato", cada uma já vinculada a si mesma (`matchActions="vincular"`, `matchTargets=tx.id`).
- Salvar faz UPDATE (category/subcategory/subcategory2, description, supplier_id/client_id) — nunca insert nem delete.
- Sem detecção de órfãos, sem fingerprint e sem trava de divergência de total nesse modo.
- Rascunho persiste em `eva.import-review.v1.<userId>.<batchKey>` e é retomado automaticamente.
