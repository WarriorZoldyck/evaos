# Corrigir erro ao aprovar lançamentos da EVA (conta PF)

## O que está acontecendo (confirmado no banco)

As 6 parcelas de "Roupa Organzza" estão em Análises EVA com:
- `credit_card_id` = cartão "ITAÚ JOÃO" (existe, ok)
- `bank_account_id` = `b19d1e22-…5643` — **essa conta bancária não existe mais** (foi excluída/substituída)

Ao aprovar, o sistema copia esse `bank_account_id` para o lançamento definitivo e o banco recusa:
`violates foreign key constraint "transactions_bank_account_id_fkey"`.

Não é problema da parcela nem do cartão: é uma referência órfã a uma conta apagada.

Hoje existem **7 pendências** (de 126) nessa situação em toda a base.

## Correção

1. **Higienização na aprovação (front-end)**
   Antes de inserir o lançamento, validar as referências da pendência contra as contas/carteiras/cartões/maquininhas que realmente existem para aquele usuário. Se a referência não existir mais, ela é descartada (vai nula) em vez de quebrar a inserção.
   Regra adicional: quando a pendência tem `credit_card_id`, o `bank_account_id` não é enviado — compra no cartão não debita a conta (o débito acontece no pagamento da fatura).

2. **Mensagem de erro compreensível**
   Trocar o texto cru do Postgres por uma mensagem em português (usando o mapeador de erros já existente), com aviso quando o vínculo foi ajustado automaticamente.

3. **Limpeza dos registros já afetados**
   Migração que zera `bank_account_id` (e demais vínculos órfãos) nas pendências que apontam para contas inexistentes — as 7 linhas atuais, incluindo as 6 parcelas da Organzza — para que a aprovação passe sem intervenção manual.

## Detalhes técnicos

- `src/hooks/useAIPendingTransactions.ts`: em `approveSingle`, buscar os IDs válidos do usuário (`bank_accounts`, `wallets`, `credit_cards`, `card_terminals`) uma vez por aprovação/lote e sanitizar o payload antes do `insert`; `approveAll` reaproveita a mesma checagem.
- Erros passam por `mapDatabaseError` em `src/lib/errorMapper.ts` nos `onError` de aprovar/aprovar todas.
- Migração SQL: `UPDATE public.ai_pending_transactions SET bank_account_id = NULL WHERE bank_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bank_accounts b WHERE b.id = ai_pending_transactions.bank_account_id);` (idem para wallet/cartão/maquininha, hoje sem casos).

## Verificação

- Reconsultar as 6 parcelas e confirmar `bank_account_id` nulo.
- Aprovar a série no app e confirmar os 6 lançamentos criados com o cartão ITAÚ JOÃO e valores de R$ 265,50.
