# Fatura na lista x modal Pagar Fatura: R$ 1.101,94 de diferença

## Causa confirmada
A diferença são exatamente 2 lançamentos do cartão 7014 em fev/2026:
- IBERIA LINEA 09/10: R$ 874,04
- SPAY *POLIMPORT 12/12: R$ 227,90

Total: R$ 1.101,94. A lista mostra 131 lançamentos e a janela de pagamento mostra 133.

Com o filtro de conta **SANTANDER**, a lista só mostra os lançamentos de cartão que têm a conta Santander registrada. Esses 2 foram lançados no cartão sem a conta. Por isso ficam fora da lista, mas entram na janela de pagamento, que busca pelo cartão. Nesse usuário há 67 lançamentos de cartão na mesma situação (outros meses também).

## Correção
1. **Dados:** preencher a conta que falta nos lançamentos de cartão, usando a conta de pagamento do próprio cartão (os 67 desse usuário e os de outros usuários com o mesmo problema).
2. **Filtro de conta:** ao escolher uma conta bancária, mostrar também todos os lançamentos dos cartões pagos por essa conta, mesmo quando falta a conta no lançamento. Assim a lista e a janela de pagamento usam a mesma regra.
3. **Novos lançamentos:** lançamentos de cartão passam a receber automaticamente a conta do cartão quando ela não for informada.
4. **Aviso de diferença:** se ainda houver diferença, a janela Pagar Fatura mostra "A lista mostra R$ X (N itens); a fatura completa tem R$ Y (M itens)" e marca os itens que estão fora do filtro da tela, para o usuário ver onde está a diferença.

## Detalhes técnicos
- Migração: `UPDATE transactions t SET bank_account_id = c.bank_account_id FROM credit_cards c WHERE t.credit_card_id = c.id AND t.bank_account_id IS NULL;` + trigger BEFORE INSERT/UPDATE que faz o mesmo preenchimento.
- `useTransactions.ts` (filtro `bank:`): `.or("bank_account_id.eq.X,credit_card_id.in.(cartões com bank_account_id = X)")`.
- `CreditCardBillPaymentModal`: nova prop opcional `listedTotal`/`listedIds` enviada pela linha da fatura em `Lancamentos.tsx`/`TransactionTable.tsx`; exibe um alerta e um selo "fora do filtro" quando os valores forem diferentes.
