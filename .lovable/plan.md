

# Fix: D+2 Parcelado — Separar Intervalo de Parcela do Prazo de Liquidação

## Problema

A lógica atual usa `settlement_days_credit` como **intervalo entre parcelas**. Quando D+2 e `auto_anticipation = false`, calcula: D+2, D+4, D+6... (errado). O correto é:

- Parcelas sempre com **30 dias de intervalo** (padrão de mercado)
- D+X é o **prazo de liquidação** após o vencimento de cada parcela
- Exemplo 3x D+2: vencimentos em +30, +60, +90 dias → recebimento em +32, +62, +92 (dias úteis)

A inferência na migration anterior (`settlement_days_credit < 30 → auto_anticipation = true`) também precisa ser revertida, pois nem toda maquininha D+2 tem antecipação automática.

## Mudanças

### 1. Migration: Reverter inferência automática

```sql
UPDATE public.card_terminals
SET auto_anticipation = false
WHERE auto_anticipation = true;
```

Zera a inferência. O usuário habilita manualmente quando necessário.

### 2. TransactionFormModal — save logic (linha 630-635)

Corrigir o cálculo para `auto_anticipation = false`:

```text
ANTES (errado):
  addDays(competence_date, settlementDays * (i + 1))
  → D+2: 2, 4, 6 dias (tudo junto)

DEPOIS (correto):
  // Vencimento: parcela mensal padrão (30 dias * parcela)
  vencimento = addDays(competence_date, 30 * (i + 1))
  // Recebimento: D+X úteis após vencimento
  payDate = addBusinessDays(vencimento, settlementDays)
  → D+2: 30+2, 60+2, 90+2 dias úteis

auto_anticipation = true (inalterado):
  addBusinessDays(competence_date, settlementDays)
  → Todas parcelas na mesma data
```

### 3. terminalPreview + InstallmentPreviewTable (linha 1644-1651)

Mesma correção no preview: quando `auto_anticipation = false`, base date = `addDays(paymentDate, 30)` com `customDays = 30`, e adicionar D+X business days em cada parcela. Na prática, usar `intervalType = "custom_days"` com `customDays = 30` e somar `settlementDays` business days ao paymentDate base.

Simplificação: passar `paymentDate = addBusinessDays(addDays(date, 30), settlementDays)` e `customDays = 30` para que o preview mostre as datas corretas.

### 4. MdrInfoCard (linha 79-84)

Mesma correção nos cálculos de data de recebimento para exibição no card.

### 5. Arredondamento de centavos

Adicionar lógica para jogar a diferença de centavos na última parcela:

```text
grossPerInstallment = Math.floor((total / N) * 100) / 100
lastInstallment = total - grossPerInstallment * (N - 1)
```

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Reverter `auto_anticipation = true` inferido |
| `TransactionFormModal.tsx` | Save logic + preview: 30 dias intervalo + D+X liquidação |
| `MdrInfoCard.tsx` | Datas de recebimento com lógica correta |

