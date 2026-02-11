

## Correcao: Data de Vencimento do Cartao de Credito

### Problema

Quando o usuario seleciona um cartao de credito em uma despesa, o sistema esta definindo a **data de pagamento** como o **dia de fechamento** (`closing_day`) em vez do **dia de vencimento** (`due_day`).

O codigo atual no arquivo `PaymentMethodFields.tsx` (linhas 71-86) calcula a data usando `selectedCreditCard.closing_day` e a salva diretamente como `payment_date`.

### Logica Correta

A data de pagamento deve ser o **dia do vencimento** (`due_day`), calculada com base no ciclo de fechamento:

1. Se hoje esta **antes** do dia de fechamento, a fatura atual vence no **mes atual** no `due_day`
2. Se hoje esta **no dia ou apos** o fechamento, a fatura vence no **proximo mes** no `due_day`
3. Se o `due_day` for menor que o `closing_day` (ex: fecha dia 25, vence dia 5), o vencimento cai no mes seguinte ao fechamento

### Exemplo

- Cartao: Fechamento dia 25, Vencimento dia 5
- Hoje: 11/02/2026 (antes do fechamento dia 25)
- Fatura atual fecha em 25/02/2026
- **Vencimento correto: 05/03/2026** (mes seguinte ao fechamento)
- Atualmente o sistema coloca: 25/02/2026 (errado, usa o fechamento)

### Alteracao

**Arquivo:** `src/components/lancamentos/PaymentMethodFields.tsx`

Substituir o `useEffect` (linhas 71-86) para:

1. Determinar o mes de fechamento da fatura atual
2. Calcular a data de vencimento usando `due_day`
3. Se `due_day` < `closing_day`, avancar um mes (vencimento cai no mes seguinte ao fechamento)
4. Definir `payment_date` com a data de vencimento correta

