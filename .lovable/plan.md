## Ação

**Excluir os 28 lançamentos** criados pela importação no cartão **MASTERCARD BLACK (1973)** do usuário `espclin@hotmail.com`, para ele reimportar do zero.

- **Escopo**: transações com `user_id = b049592f-...`, `credit_card_id = 3533ea3a-...` (1973), `external_id LIKE 'import_%'`, criadas em **2026-07-08 03:17:24** (9 rows, R$ 2.320,71) e **2026-07-09 23:16:23** (19 rows, R$ 1.163,62). Total a excluir: **28 rows / R$ 3.484,33**.
- **Preservado**: os 55 lançamentos pré-existentes da fatura 21/06 (R$ 8.745,37) — parcelas de compras anteriores dele.

## Causa da divergência (para ajustar depois)

O extrato tinha 59 linhas = R$ 8.850,02. O sistema já tinha 55 pendentes na mesma fatura = R$ 8.745,37 (parcelas antigas). O matcher não casou porque descrição/data das parcelas divergem das linhas do extrato, então o usuário provavelmente marcou várias como "criar como nova" — inflando a fatura para R$ 9.908,99 (55 antigas + 19 novas do 2º lote, sem contar o 1º lote).

## Próximo passo (após o rollback, se ele quiser)

Melhorar o matcher para reconhecer parcelas de compras anteriores (descrição-base igual, parcela X/Y, mesma data de fechamento) como candidatas fortes ao par de conciliação — reduzindo a chance do usuário duplicar.

## Comando de rollback

```sql
DELETE FROM public.transactions
WHERE user_id = 'b049592f-d97a-468d-a839-ed02c2a41d9b'
  AND credit_card_id = '3533ea3a-6a17-4316-af2b-0071fc64cddd'
  AND external_id LIKE 'import_%'
  AND created_at >= '2026-07-08 03:17:00+00'
  AND created_at <  '2026-07-09 23:17:00+00';
-- Espera-se: 28 rows afetadas.
```
