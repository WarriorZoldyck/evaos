## Problema

A fatura de março/2026 do MASTERCARD BLACK do usuário `espclin@hotmail.com` está com **48 lançamentos / R$ 12.193,12**, mas o correto são **43 lançamentos / R$ 9.521,13**.

A diferença (5 lançamentos extras, ~R$ 2.672) vem todinha da **parcela 4** de 5 séries de cartão que está caindo em **21/03/2026** em vez de **21/06/2026**:

| série | parcela 4 (errada) | valor |
|---|---|---|
| Bisturi elétrico (4x) | 21/03 | R$ 799,00 |
| Espaço Clínico (9x) | 21/03 | R$ 1.412,60 |
| Aramis (4x) | 21/03 | R$ 167,14 |
| Eva - Pagamento Otávio (5x) | 21/03 | R$ 190,36 |
| papelbrink (8x) | 21/03 | R$ 102,90 |

Padrão em todas: p1=21/03, p2=21/04, p3=21/05, **p4=21/03** (errado), p5=21/07 (pula 21/06).

## Causa raiz

A migration anterior de reversão (`20260601224831…`) selecionou TODAS as transações com `payment_date = 2026-03-21` do cartão e recalculou `payment_date` a partir do `competence_date` + ciclo do cartão, **sem somar `(installment_number - 1)` meses**. Como todas as parcelas da mesma série compartilham `competence_date` (data da compra), a parcela 4 (que estava corretamente em 21/06) foi reconvertida em 21/03.

## Plano

### 1) Migration corretiva (apenas dados)

Para cada `transactions` com `credit_card_id` não-nulo, `installment_number > 1`, `installments_total > 1` e `series_id` não-nulo:

```text
payment_date_correto = primeiraParcelaPaymentDate + (installment_number - 1) meses
```

onde `primeiraParcelaPaymentDate` é o `payment_date` da parcela 1 da mesma `series_id`. Aplicar somente quando o valor calculado for ≠ do atual. Escopo restrito ao usuário `b049592f-…` e cartão `3533ea3a-…` para minimizar risco; depois de validado, posso ampliar se necessário.

Validação pós-migration: verificar nas 5 séries acima que p4 ficou em 21/06 e que a fatura de março volta a ter 43 lançamentos e R$ 9.521,13.

### 2) Blindagem do código (causa raiz da repetição)

Em qualquer caminho que **edite** `payment_date` em massa para cartão de crédito (whatsapp-webhook, eva-chat, modal de lançamento, futuras migrations de correção), adicionar a regra:

- Se `installments_total > 1` e `series_id` definido → `payment_date = baseDueDate + (installment_number - 1) meses`, onde `baseDueDate` vem do `competence_date` + `closing_day`/`due_day` (parcela 1).
- Nunca aplicar o cálculo de ciclo isoladamente a uma parcela > 1.

Centralizar isso em um util `getInstallmentPaymentDate(competenceDate, closingDay, dueDay, installmentNumber)` e reusar no webhook e no modal.

### 3) Não mexer no que já está certo

- Não tocar nas faturas 21/01 e 21/02 (pagas e corretas).
- Não tocar nas parcelas que não estão em 21/03 incorretamente.
- Não alterar `competence_date` — só `payment_date`.

## Detalhes técnicos

```sql
-- pseudo-SQL da migration
WITH first_inst AS (
  SELECT series_id, payment_date AS base_pd
  FROM transactions
  WHERE credit_card_id = '3533ea3a-…'
    AND installment_number = 1
    AND series_id IS NOT NULL
)
UPDATE transactions t
SET payment_date = (fi.base_pd + ((t.installment_number - 1) || ' months')::interval)::date
FROM first_inst fi
WHERE t.series_id = fi.series_id
  AND t.installment_number > 1
  AND t.credit_card_id = '3533ea3a-…'
  AND t.payment_date <> (fi.base_pd + ((t.installment_number - 1) || ' months')::interval)::date;
```

Confirmo a execução com o resumo antes/depois assim que você aprovar.
