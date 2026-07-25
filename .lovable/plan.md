# Botão "Cancelar importação" sempre visível

## Contexto

`src/pages/ImportarExtrato.tsx` já tem um botão "Voltar para Lançamentos" no topo da página, mas ele rola junto com o conteúdo. Nas etapas mais longas (Conferir, Conciliar, Resumo), o usuário precisa rolar até o topo para sair — o que ele quer evitar.

## Mudança

Arquivo único: `src/pages/ImportarExtrato.tsx`.

- Transformar a barra superior em `sticky top-0 z-40` com fundo sólido (`bg-background/95 backdrop-blur` + borda inferior), acompanhando o padrão dos demais cabeçalhos fixos do app.
- Renomear o label para **"Cancelar importação"** (mais claro que "Voltar" quando há trabalho em andamento) e manter o ícone `X` (ou `ArrowLeft` + texto) — usar `X` para reforçar cancelamento.
- Manter `goBack()` como handler (já dispara `fetchTransactions()` via `onClose` do modal, e retorna com animação).
- ESC continua funcionando.

Nenhuma mudança em `ImportStatementModal.tsx` ou na lógica de importação — o botão já chama `onClose`, que a página trata como cancelamento/saída limpa.

## Fora de escopo

- Confirmação "tem certeza que quer cancelar?" (pode ser um follow-up se o usuário pedir).
- Alterar os botões internos "Cancelar/Voltar" do rodapé de cada step do modal.
