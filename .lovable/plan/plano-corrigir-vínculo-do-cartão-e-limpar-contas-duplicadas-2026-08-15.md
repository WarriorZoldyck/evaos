# Plano: Corrigir vínculo do cartão e limpar contas duplicadas (Sabrina)

## Contexto
A usuária `sabrinadomingues04@gmail.com` reportou que o saldo total (R$ 5.883,77) está R$ 3.000 acima do esperado (R$ 2.883,77). A causa: o cartão "Itaú João" está vinculado a uma conta bancária "Itaú João" com saldo inicial de R$ 3.000 (que não existe na realidade). A fatura de R$ 3.000 foi debitada dessa conta fantasma, não do Santander (onde ela realmente pagou). Além disso, existem contas e cartões duplicados entre os contextos Pessoal e Empresa.

## Diagnóstico confirmado (queries no banco)
- Cartão "Itaú João" (3c5049c1) → vinculado à conta "Itaú João" (64ec436c, saldo inicial 3.000)
- 29 transações de cartão (R$ 3.000 total, pagas em 09/07/2026) debitaram a conta "Itaú João" → saldo foi a 0
- Santander (1613aa1d) não foi afetado → continua com R$ 5.883,77
- Conta "Itaú PF" (9a187250, inicial 3.379,99) tem 1 PIX de transferência interna (-3.379,99) → saldo 0
- Contas/cartões duplicados: "Itaú João"/"ITAÚ JOÃO" e "Itaú Sabrina"/"ITAÚ SABRINA" (Pessoal vs Empresa)

## Etapas

### 1. Re-vincular o cartão "Itaú João" ao Santander
```sql
UPDATE credit_cards
SET bank_account_id = '1613aa1d-1dc6-4c23-a567-fa856c52be3e'  -- Santander
WHERE id = '3c5049c1-dcc0-4f64-baa6-92621d06cbee';
```

### 2. Mover as 29 transações de cartão para o Santander
```sql
UPDATE transactions
SET bank_account_id = '1613aa1d-1dc6-4c23-a567-fa856c52be3e'  -- Santander
WHERE bank_account_id = '64ec436c-4122-44bf-8d23-4af054cf5e2a'  -- Itaú João (antiga)
  AND credit_card_id = '3c5049c1-dcc0-4f64-baa6-92621d06cbee'
  AND user_id = (SELECT id FROM auth.users WHERE email = 'sabrinadomingues04@gmail.com');
```
**Efeito:** Santander passa de 5.883,77 → 2.883,77 (−3.000). Conta "Itaú João" fica com 0 e sem transações.

### 3. Zerar o saldo inicial da conta "Itaú João" fantasma
```sql
UPDATE bank_accounts
SET initial_balance = 0
WHERE id = '64ec436c-4122-44bf-8d23-4af054cf5e2a';
```
**Efeito:** Remove os 3.000 inventados. A conta passa a existir mas com saldo 0 (pode ser excluída depois pela própria usuária se quiser).

### 4. Limpar contas e cartões duplicados (Pessoal)
As contas "ITAÚ JOÃO" (b19d1e22, saldo 0, 0 txs) e "ITAÚ SABRINA" (e1575f01, saldo 0, 1 tx de 500) e seus cartões são duplicatas vazias do contexto Pessoal.

- Excluir cartões Pessoais duplicados:
```sql
DELETE FROM credit_cards WHERE id IN ('2249d5cb-9714-4456-9683-7f7cacbdc6b6', '990b7b5e-c3b9-4348-b6f0-b71961a68e4e');
```
- Excluir conta "ITAÚ JOÃO" (0 transações, saldo 0):
```sql
DELETE FROM bank_accounts WHERE id = 'b19d1e22-a304-451d-b01b-11e44c375643';
```
- Para "ITAÚ SABRINA": tem 1 transação (PIX recebido de 500). Mover essa transação para o Santander antes de excluir, ou deixá-la e apenas desativar.

### 5. Verificação pós-migração
Após executar, consultar:
```sql
SELECT ba.name, ba.initial_balance,
  ba.initial_balance + COALESCE(SUM(CASE WHEN t.type='receita' THEN t.amount ELSE -t.amount END),0) AS saldo
FROM bank_accounts ba
LEFT JOIN transactions t ON t.bank_account_id = ba.id AND t.status='Pago' AND t.user_id = ba.user_id
WHERE ba.user_id = (SELECT id FROM auth.users WHERE email = 'sabrinadomingues04@gmail.com')
GROUP BY ba.id, ba.name, ba.initial_balance
ORDER BY ba.name;
```
**Esperado:** Santander = 2.883,77 (±1,03 de arredondamento de data). Total = 2.883,77.

## Observações
- Nenhuma transação é deletada — apenas `bank_account_id` é atualizado
- O saldo inicial da conta fantasma é zerado (não excluído para preservar integridade referencial)
- A Sabrina pode excluir a conta "Itaú João" manualmente após a migração se quiser
- Nenhuma alteração de código frontend é necessária — é puramente correção de dados
