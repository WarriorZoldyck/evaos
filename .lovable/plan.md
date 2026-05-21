## Problema

Quando uma compra parcelada é registrada via WhatsApp (especialmente em cartão de crédito), o resumo enviado de volta mostra datas de vencimento **diferentes das que foram realmente salvas** no app. À vista funciona porque só existe uma data.

## Causa

No `supabase/functions/whatsapp-webhook/index.ts`, ao gravar as parcelas em `ai_pending_transactions`, o sistema calcula corretamente o `payment_date` de cada parcela com base no ciclo do cartão (fechamento/vencimento), incrementando mês a mês.

Porém, na hora de montar a mensagem de feedback (linhas ~3005-3008 e ~999-1001), o código usa `detail.due_date` — a data **bruta vinda da IA**, que normalmente é só `competence_date + N meses` sem considerar o ciclo do cartão. Resultado: a mensagem mostra datas erradas, mesmo que o banco esteja correto.

## Correção

Em ambos os blocos de parcelamento do webhook:

1. **Bloco principal de parcelas (linhas ~2920-3030)** — guardar o `installmentPaymentDate` calculado dentro do map (já existe como variável local) num array paralelo, e usar esse array (não `installmentDetails[i].due_date`) para montar `parcelsDisplay`.

2. **Bloco de confirmação prévia (linhas ~931-1010, fluxo `confirm_pending`)** — fazer o mesmo: usar o `payment_date` já calculado e gravado em cada transação, não o `due_date` original do payload.

Sem mudanças em UI, banco, IA ou prompt — apenas trocar a fonte da data exibida no resumo do WhatsApp para refletir o que foi efetivamente salvo.

## Arquivos

- `supabase/functions/whatsapp-webhook/index.ts` (somente)
