# Corrigir "Manter" nas Duplicatas (Análises EVA)

## Problema confirmado
Na aba Duplicatas, o botão "Manter" chama `keepOne({ keepId })`, que só move o item clicado para "pendente" e deixa os demais do grupo como `duplicate_suspect`. A mensagem exibida ("os demais continuam aguardando sua decisão") reflete esse comportamento, mas não é o esperado: os outros itens continuam vivos e podem acabar aprovados, gerando duplicidade.

## Comportamento desejado
Ao clicar em "Manter" em um item do grupo:
- Esse item vira `pending` (vai para a lista de pendentes normal).
- Todos os outros itens do mesmo grupo são marcados como `rejected`.
- O grupo some da aba Duplicatas.
- Toast: "Lançamento mantido. Os outros N duplicados foram rejeitados."

## Detalhes técnicos
- `src/hooks/useAIPendingTransactions.ts`: `keepOneMutation` passa a receber `{ keepId, clusterIds }`. Faz um update para `pending` no `keepId` e outro update para `rejected` (com `reviewed_at`) nos `clusterIds` restantes, com invalidação das queries como já ocorre hoje.
- `src/pages/AnalisesEva.tsx` (linha ~1189): passar `clusterIds: cluster.map(c => c.id)` na chamada do botão "Manter".
- Cluster de 1 item: sem mudança (só o próprio vira pendente).
- Sem alterações de banco de dados.
