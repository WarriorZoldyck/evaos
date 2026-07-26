## Ajuste

Remover a coluna "Revisar" da tabela de "Só no extrato". A pergunta (modal de revisão) já é disparada quando o usuário ativa o toggle "Criar" — não precisa de badge/coluna extra embaixo dizendo "Revisar" ou "Aguardando revisão".

## Mudanças

### `src/components/lancamentos/import/ReconcileStep.tsx`

- Tabela "Só no extrato": remover a coluna `<th>Revisar</th>` do cabeçalho e a `<td>` correspondente de cada linha (o bloco inteiro que renderiza os badges "Revisar" / "Aguardando revisão" / "Revisada").
- Após revisão, mostrar um selo discreto **verde "Revisada"** ao lado do toggle (na mesma célula da coluna "Ação"), com link "editar" abaixo para reabrir o modal. Sem selo âmbar de "aguardando".
- Ajustar `min-w` da tabela para o novo número de colunas.

### Comportamento (já funcional, sem mudança)

- Toggle desligado (padrão) = Ignorar, categoria continua editável.
- Ativar toggle → abre `ReviewNewEntryModal` imediatamente com descrição, fornecedor e categoria.
- Confirmar revisão → toggle permanece em "Criar" com selo verde "Revisada".
- Fechar sem confirmar → toggle volta para "Ignorar" (já implementado no `ImportStatementModal`).

### `src/components/lancamentos/ImportStatementModal.tsx`

Sem mudanças estruturais. O contador `blocked` (linhas em "criar" ainda não revisadas) permanece — mas agora só dispara na prática se o usuário reabrir e cancelar após ter revisado antes, cenário raro.
