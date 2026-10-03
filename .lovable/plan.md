# Mover os 31 lançamentos da Sabrina para o cartão ITAÚ JOÃO (Pessoal)

## O que o banco de dados mostra
- Usuária: sabrinadomingues04@gmail.com.
- Os 31 lançamentos das imagens (fatura set/2026, vencimento 10/09, R$ 1.298,21, todos "Pendente") **já estão no cartão ITAÚ JOÃO PF**, que é Pessoal.
- Mesmo assim, eles aparecem na PJ porque esse cartão está configurado para ser **pago pela conta Santander, que é da empresa**. Hoje, quando um lançamento tem conta bancária, o sistema define o contexto pela conta, e não pelo cartão. Então o Santander (PJ) acaba puxando os lançamentos para a empresa.
- Por isso o "Mover contexto" bloqueou e mostrou "— Santander".

## O que vai mudar
1. **Regra de contexto**: quando o lançamento for de cartão, o contexto passa a vir **do cartão**, não da conta que paga a fatura. Assim, cartão pessoal continua pessoal, mesmo que a fatura seja paga por uma conta da empresa.
2. **Correção dos dados**: os 31 lançamentos vão para **Pessoal**, no mesmo cartão ITAÚ JOÃO PF. A data, a descrição, o valor, a categoria, o status e a conta que paga a fatura continuam iguais.
3. **Conferência**: a fatura set/2026 do ITAÚ JOÃO PF aparece no Pessoal com 31 itens e R$ 1.298,21, e sai da lista da PJ.

Os 25 lançamentos do cartão "Itaú João PJ" (R$ 2.878,79) ficam como estão, porque esse cartão é da empresa.

## Detalhes técnicos
- Migração: reescrever `inherit_company_from_account()` com esta ordem: `credit_card_id`, depois `bank_account_id`, depois `wallet_id`. Os triggers existentes continuam os mesmos.
- Dados (run_sql): `UPDATE transactions SET company_id = NULL WHERE user_id='e6dd9e8e-…' AND credit_card_id='2249d5cb-9714-4456-9683-7f7cacbdc6b6' AND payment_date='2026-09-10' AND company_id IS NOT NULL` (espera-se que atinja 31 linhas). Antes, confirmar que set/2026 não está em `closed_bill_cycles`.
- Varredura: contar, em todos os usuários, os lançamentos em que o contexto do cartão é diferente do contexto do lançamento, e corrigir da mesma forma.
