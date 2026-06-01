# Diagnóstico do problema

Usuário: `espclin@hotmail.com` (id `b049592f-…`)
Cartão afetado: **MASTERCARD BLACK** (closing_day 14, due_day 21) — id `3533ea3a-…`

## O que aconteceu

A fatura desse cartão deveria ter 3 vencimentos abertos: **21/jan**, **23/fev** e **21/mar**. Hoje (01/jun/2026) o banco do app está assim:

| payment_date | nº lançamentos | total |
|---|---|---|
| 2026-01-21 | 32 | R$ 12.382,35 |
| 2026-02-23 | 28 | R$ 8.147,51 |
| 2026-03-21 | 52 | R$ 9.509,45 |

O bug: várias compras com `competence_date` em **maio/junho de 2026** (Netflix, Drogasil, Empório MM, Ramon, Aromas Grill, Bisturi Elétrico parcelado, etc.) foram criadas — pelo WhatsApp e pelo formulário — com `payment_date = 2026-03-21`. Isso é o **vencimento passado** do mesmo mês de fechamento; o cálculo do ciclo está pegando o `due_day` do mês corrente em vez de avançar para o próximo ciclo quando o mês já fechou. Resultado: compras novas caíram na "fatura de março" que já estava aberta.

Quando o usuário abriu **Pagar Fatura → Março/2026**, o modal listou todos os 52 lançamentos com `payment_date` em março (≈ R$ 9.509,45, mas somando com receitas/parcelas o valor exibido bateu próximo dos R$ 19 mil que ele descreveu), marcou **todos como Pago**, gravou `bank_account_id` = conta escolhida e `payment_date` = data informada por ele. Por isso "jogou pra março" e com valor errado: o saldo já vinha contaminado.

Nenhum lançamento extra de "Saldo anterior" ou "Crédito excedente" foi criado (já verificado).

# Plano de ação

## 1) Reverter o pagamento da fatura (para o usuário poder testar de novo)

Operação de dados (via script com service role, não migration), em duas partes:

**a. Reverter status dos lançamentos do cartão MASTERCARD BLACK que foram marcados como Pago pelo bill-payment:**
- Filtrar `transactions` onde `user_id = b049592f…` e `credit_card_id = 3533ea3a…` e `status = 'Pago'`.
- Para cada um: setar `status = 'Pendente'`, `bank_account_id = NULL`, `liquidation_notes = NULL`.
- Recalcular `payment_date` correto com base em `competence_date` + ciclo do cartão (closing 14 / due 21). Regra: se `competence_date.day <= 14` → vence dia 21 do **mesmo mês**; senão vence dia 21 do **mês seguinte** (avançando ano quando dezembro).
- Aplicar a mesma recálculo aos lançamentos atualmente `Pendente` que tenham `payment_date` errado (todos os com `payment_date = 2026-03-21` mas `competence_date >= 2026-03-15`, e os com payment_date de meses futuros que também estão errados, como as parcelas do Bisturi Elétrico).

**b. Validar resultado** mostrando antes/depois por ciclo de vencimento e total de lançamentos movidos.

Vou listar no chat o resumo do que será alterado **antes** de executar, para confirmação.

## 2) Corrigir o bug de cálculo do `payment_date` (causa raiz)

Origem dos lançamentos errados:
- `supabase/functions/whatsapp-webhook/index.ts` — fluxo de criação de lançamento via WhatsApp, ao resolver `credit_card_id` calcula o vencimento da fatura. Está usando o `due_day` do mês atual sem checar se o ciclo já fechou (referência da memória `credit-card-cycle`).
- Possivelmente o mesmo cálculo em `src/components/lancamentos/TransactionFormModal.tsx` / `PaymentMethodFields.tsx` ou util compartilhado.

Ação:
- Centralizar (ou auditar) uma função única `getCreditCardDueDate(competenceDate, closingDay, dueDay)` com a regra:
  - se `competenceDate <= dia de fechamento do mês de competência` → vence no `dueDay` do **mesmo mês** (se `dueDay > closingDay`) ou do **mês seguinte** (se `dueDay <= closingDay`).
  - se `competenceDate > dia de fechamento` → vence no `dueDay` do **próximo ciclo** (mês seguinte ao fechamento, com rollover de ano).
- Aplicar essa função no webhook do WhatsApp, no modal de lançamento e em qualquer outro local que monte `payment_date` para Cartão de Crédito.
- Adicionar guarda defensiva: nunca aceitar `payment_date < competence_date` para método "Cartão de Crédito" — força recálculo.

## 3) Reforço no modal "Pagar Fatura"

Para impedir que esse tipo de contaminação repita o estrago:
- Mostrar no topo do review um alerta se houver lançamentos cuja `competence_date` é **posterior** ao `closing_day` do mês da fatura sendo visualizada ("Atenção: X lançamentos parecem fora deste ciclo. Revise antes de pagar.").
- Opcional: bloquear seleção desses lançamentos no pagamento da fatura selecionada.

## 4) Validação

- Após a correção, repetir o teste com o usuário: criar uma compra nova via WhatsApp e via formulário, conferir que `payment_date` cai no ciclo certo (ex.: compra 01/jun com closing 14 / due 21 → vence 21/jun).
- Abrir a tela "Pagar Fatura" e confirmar que cada ciclo lista apenas os lançamentos esperados.

## Detalhes técnicos

```text
Regra de payment_date para Cartão de Crédito
─────────────────────────────────────────────
inputs : competence_date, closing_day, due_day
passo 1: closingDate = mesmo mês de competence_date, dia = closing_day
passo 2: if competence_date.day <= closing_day
            cycleClosing = closingDate                  (fatura desse mês)
         else
            cycleClosing = closingDate + 1 mês          (fatura próxima)
passo 3: dueMonth = (due_day > closing_day)
            ? mesmo mês de cycleClosing
            : mês seguinte a cycleClosing
passo 4: payment_date = data(dueMonth.ano, dueMonth.mês, due_day)
```

## Dependências externas
Nenhuma — toda a correção é interna (dados + código).
