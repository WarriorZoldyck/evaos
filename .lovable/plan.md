

# Antecipacao Automatica na Maquininha + Fix D+2

## Problema

Atualmente o sistema assume que parcelas de credito via maquininha sempre tem intervalo D+30/D+60/D+90 (calendario). Mas muitas maquininhas tem **antecipacao automatica**, onde TODAS as parcelas caem no mesmo D+X (ex: D+2). O campo `settlement_days_credit` ja existe mas e usado como intervalo entre parcelas, nao como dia unico de recebimento.

A imagem mostra "TESTE D+2 (2x)" com datas 04/03 e 06/03 -- o sistema esta tratando D+2 como intervalo (D+2, D+4), quando deveria ser: ambas parcelas caem em D+2 da venda.

## Solucao

### 1. Migration: Adicionar campo `auto_anticipation` ao `card_terminals`

```sql
ALTER TABLE public.card_terminals
  ADD COLUMN auto_anticipation boolean NOT NULL DEFAULT false;

-- Inferir para terminais existentes: se settlement_days_credit < 30, provavelmente e antecipacao
UPDATE public.card_terminals
  SET auto_anticipation = true
  WHERE settlement_days_credit IS NOT NULL AND settlement_days_credit < 30;
```

Campo nullable = false com default false, sem risco para dados existentes. Terminais com D+ credito < 30 sao inferidos como antecipacao automatica.

### 2. TerminalFormModal: Toggle de antecipacao

Adicionar um switch/toggle na tela da maquininha:
- **"Antecipacao automatica?"** -- boolean
- Quando ativo, o campo "D+ Credito" passa a significar "em quantos dias recebo TODAS as parcelas" (ex: 2)
- Quando inativo, comportamento atual (D+30 entre parcelas)

Carregar/salvar o novo campo `auto_anticipation` junto com os demais.

### 3. TransactionFormModal (save logic, ~linha 610-644)

Quando terminal tem `auto_anticipation = true`:
- **Todas** as parcelas recebem a **mesma** `payment_date`: `addBusinessDays(competence_date, settlement_days_credit)`
- Valor liquido por parcela continua igual (bruto/N - MDR)
- `installment_number` e `installments_total` continuam preenchidos normalmente

Quando `auto_anticipation = false` (padrao atual):
- Manter logica atual: `addDays(competence_date, settlementDays * (i + 1))`

### 4. MdrInfoCard: Datas de recebimento

Quando `auto_anticipation = true`:
- Mostrar uma unica data para todas as parcelas em vez de N datas diferentes
- Texto: "Todas as parcelas em D+X (dd/MM/yyyy)"

Precisa receber a flag `auto_anticipation` do terminal. O `CardTerminalInfo` interface ja tem os campos necessarios, so precisa adicionar `auto_anticipation`.

### 5. terminalPreview (TransactionFormModal, ~linha 1146-1178)

Quando `auto_anticipation = true`:
- Retornar flag `autoAnticipation: true` no objeto
- O `InstallmentPreviewTable` recebe `customDays = 0` (ou logica especial) para que todas parcelas tenham a mesma data

Alternativa mais simples: forcar `intervalType = "custom_days"` com `customDays = 0` e ajustar a data base para ser `addBusinessDays(paymentDate, settlementDays)` -- todas parcelas na mesma data.

### 6. Integridade de dados

- **Nenhuma transacao existente e alterada** -- apenas novas transacoes usam a nova logica
- Terminais existentes ganham `auto_anticipation` inferido (< 30 dias = true)
- Transacoes ja criadas com datas D+30/D+60 permanecem como estao

### Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | `ADD COLUMN auto_anticipation boolean DEFAULT false` + UPDATE inferencia |
| `src/integrations/supabase/types.ts` | Regenerado automaticamente |
| `src/hooks/useTransactions.ts` | Adicionar `auto_anticipation` ao select de `card_terminals` |
| `src/hooks/useAccounts.ts` | Adicionar `auto_anticipation` ao `createCardTerminal` |
| `src/components/contas/TerminalFormModal.tsx` | Toggle de antecipacao |
| `src/components/lancamentos/TransactionFormModal.tsx` | Save logic + terminalPreview |
| `src/components/lancamentos/MdrInfoCard.tsx` | Datas unicas quando antecipacao |
| `src/components/lancamentos/PaymentMethodFields.tsx` | Sem mudanca (ja passa terminal) |

