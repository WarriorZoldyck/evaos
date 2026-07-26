## Objetivo

Novos lançamentos ("Só no extrato" e "Criar novo" no bloco Provável) devem nascer com o toggle desligado ("ignorar") e um aviso "Revisar". Ativar o toggle abre o modal de revisão; ao confirmar, o toggle fica em "Criar" com badge verde "Revisada". Sem botão separado — o próprio toggle conduz o fluxo.

## Mudanças

### `src/components/lancamentos/import/ReconcileStep.tsx`

- Linhas novas (extrato-only e "Criar novo" da seção Provável) passam a nascer com `rowActions[i] = "ignorar"` (hoje nascem como `"criar"`).
- Coluna **Ação** dessas linhas: remover o botão "Revisar e criar" / "É outra compra — criar". Manter apenas o `NeuToggle` já usado nas demais linhas (rótulo "Ignorar" à esquerda, "Criar" à direita).
- Ao ligar o toggle (ignorar → criar) numa linha ainda não revisada: chamar `onOpenReview(i)` automaticamente. Se o usuário fechar/cancelar o modal sem confirmar, reverter o toggle para "ignorar".
- Ao confirmar revisão: linha vai para `reviewedRows`, toggle permanece em "criar", badge verde "Revisada" aparece abaixo do toggle, com link "editar" para reabrir o modal.
- Enquanto o toggle estiver em "ignorar" numa linha nova: mostrar badge âmbar `Revisar` ao lado do combobox de categoria (edição de categoria continua habilitada normalmente).
- Bloco "Provável → Criar novo": mesmo comportamento — clicar em "Criar novo" define target=null, action="ignorar", e abre o modal. Confirmar → action="criar" + revisada. Cancelar → mantém ignorar.

### `src/components/lancamentos/ImportStatementModal.tsx`

- Cálculo de `blocked` no rodapé: bloquear importação apenas se existir linha com `action === "criar"` e ainda **não** revisada. Linhas em "ignorar" não bloqueiam.
- Contadores do resumo ("N conciliar + M criar") passam a considerar somente linhas com toggle ativado.
- Sem mudanças no `ReviewNewEntryModal` em si; a integração via `onOpenReview` / `onConfirm` já existe.

## Notas técnicas

- O bug atual em que "Revisar e criar" parecia inerte é obsoleto — o botão é removido. O disparo do modal fica atrelado ao evento `onCheckedChange` do `NeuToggle`, que já funciona (confirmado no toggle das demais linhas).
- A reversão em caso de cancelamento usa o `onClose` do `ReviewNewEntryModal`: se a linha não estiver em `reviewedRows` no fechamento, o `ReconcileStep` reseta `rowActions[i]` para `"ignorar"`.
