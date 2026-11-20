# Lembrete de vencimentos: cartão como fatura única

## O que muda
- No aviso diário do WhatsApp, compras de cartão de crédito deixam de aparecer uma a uma.
- Cada cartão aparece numa linha só: "💳 Fatura ITAÚ JOÃO — R$ 1.298,21 — Vencimento 21/11/2026 (Vence em 3 dias) — 31 lançamentos".
- Valor da fatura = despesas pendentes do cartão naquela data menos estornos/créditos (mesma regra da tela de fatura).
- Cartões adicionais (filhos) somam na fatura do cartão principal.
- Contas que não são de cartão (boletos, recorrentes) continuam listadas como hoje.
- No fim da mensagem: "Quer ver os itens de alguma fatura? É só me pedir: *detalhar fatura ITAÚ JOÃO*."
- Quando o usuário pede, a EVA lista os itens daquela fatura (já usa a busca de lançamentos existente; ajusto a instrução para reconhecer "detalhar fatura <cartão>").

## Detalhes técnicos
- `cron-whatsapp-reminders` e `test-whatsapp-reminder`: buscar também `credit_card_id` e `type` (incluindo receitas do cartão), carregar `credit_cards(id,name,parent_card_id)`, agrupar por cartão raiz + `payment_date`.
- `whatsapp-webhook`: regra no prompt para "detalhar fatura" filtrar por cartão (família) e vencimento.
- Reimplantar as três funções e rodar um teste sem envio (dry_run) para conferir a mensagem.
