## Remover completamente menu Aprovar/Cancelar/Editar do WhatsApp

Voltar 100% ao comportamento antigo (imagem 2): apenas confirmação textual "Lançamento enviado para aprovação no app" — sem menu numerado, sem link de edição no rodapé, sem lista interativa.

### O que muda em `supabase/functions/whatsapp-webhook/index.ts`

1. Remover qualquer resquício do bloco de "Ações rápidas" para novos lançamentos (o `newTxActionsTail` e o registro `new_tx_actions` em `whatsapp_pending_actions`).
2. Garantir que a mensagem de confirmação do novo lançamento **não** anexe o rodapé com `1 — Aprovar / 2 — Cancelar / 3 — Editar` nem o link `Abrir no app`.
3. Deixar o texto final igual ao modelo antigo:
   - `📋 Lançamento enviado para aprovação no app!` + dados + `⚠️ Acesse "Análises EVA" no app para aprovar.`
4. Remover/desativar o handler que interpreta respostas `1/2/3` como aprovar/cancelar/editar do último lançamento (para não confundir com outros fluxos).

### O que NÃO muda
- Fluxo de match de boleto (confirmar baixa de pendente) continua com seu próprio menu — o usuário só pediu para remover no caso de novo lançamento comum.
- Card/imagem do boleto quando há match segue igual.
