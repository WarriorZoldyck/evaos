# Taxas da Maquininha na Calculadora de Parcelamento

## Contexto

A `InstallmentCalculator` (em `src/components/precificacao-v2/InstallmentCalculator.tsx`) hoje usa apenas a taxa plana `credit_rate` da maquininha e ignora:

- **`rates_info`** — a tabela de taxas por número de parcelas (cada maquininha pode ter MDR diferente para 1x, 2x, 6x, 12x...).
- **`settlement_days_credit`** — o prazo de liquidação D+X (quando o dinheiro cai de fato na conta).
- **`auto_anticipation`** — se a maquininha antecipa (recebimento à vista em D+X) ou liquida parcelado mês a mês.

Essa mesma lógica já existe e está validada no `MdrInfoCard` (`src/components/lancamentos/MdrInfoCard.tsx`), usada ao registrar lançamentos. O objetivo é leva-la para a calculadora de precificação, onde o usuário decide quanto cobrar.

## O que vai mudar

### 1. `src/lib/installmentPricing.ts` (funções puras)

Estender `InstallmentPlanInput` e `InstallmentPlanRow` com:

- `ratesInfo?: RateInfo[]` — tabela por parcelamento.
- `settlementDaysCredit?: number` — D+X.
- `autoAnticipation?: boolean`.
- `saleDate?: Date` — data da venda, base para calcular datas de crédito.

Nova função `resolveRate(installments, fallback, ratesInfo)` que, para cada N, busca a taxa configurada para N; se não houver entrada exata, usa o degrau mais alto abaixo de N, senão cai no `credit_rate`.

`computeInstallmentRow` passa a usar `resolveRate` por parcelamento. Cada linha também calcula:

- `settlementMode`: `"lump_sum"` (antecipado, D+X < 30 ou `autoAnticipation`) ou `"installment"` (crédito mensal).
- `firstCreditDate` / `lastCreditDate`: datas reais de crédito líquido, espelhando o `MdrInfoCard` (lump-sum = venda + D+X dias; parcelado = mês i+1 + D+X dias).

### 2. `src/components/precificacao-v2/InstallmentCalculator.tsx`

- Ao escolher uma maquininha, carrega `credit_rate`, `rates_info`, `settlement_days_credit` e `auto_anticipation` (todos já disponíveis via `useAccounts`).
- Adiciona campo **Data da venda** (default hoje) para calcular datas de crédito.
- Mantém o modo "Taxa manual" (sem terminal): usa a taxa digitada, sem prazo de liquidação (como hoje).
- A tabela ganha duas colunas:
  - **Taxa** — o % MDR efetivo daquele parcelamento (varia por linha quando há `rates_info`).
  - **Recebimento** — "D+2 · 16/07" (antecipado) ou "1ª 16/08 · 12x" (parcelado mensal).
- Quando só há taxa manual (sem terminal), a coluna Recebimento fica oculta e a Taxa mostra o valor único.

### 3. Sem mudanças de banco

Nenhuma migration — todos os campos já existem em `card_terminals` (`rates_info`, `settlement_days_credit`, `auto_anticipation`).

## Detalhes técnicos

- A dedução líquida continua auto-consistente: para cada N, `netReceived ≈ netTarget` (o usuário cobra o bastante para, após o MDR daquele parcelamento, receber o líquido desejado).
- Datas calculadas com `Date` puro (sem depender de `date-fns` no lib, mantendo-o testável).
- Os testes existentes em `src/lib/installmentPricing.test.ts` continuam passando (a assinatura base é compatível; novos campos são opcionais).
