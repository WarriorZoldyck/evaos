

# Melhorias nos Lançamentos Parcelados na Análises EVA

## Problemas Identificados

### 1. Parcelas aparecem como cards separados
No banco, a Pneulandia 6x está como 5 registros individuais (2/6 a 6/6) na `ai_pending_transactions`. Na UI, cada um vira um card separado. O correto é agrupar por `series_id` e mostrar como **um único card** com as parcelas destrinchadas dentro.

### 2. Data errada (2025 em vez de 2026)
A `competence_date` dos lançamentos da Paula está como `2025-03-26` — um ano atrás. Isso acontece porque a IA (GPT) está retornando o ano errado no campo `date`/`competence_date` e o webhook aceita sem validar. Solução: adicionar validação no webhook para corrigir datas com ano claramente errado.

### 3. Status "Pago" em parcelas futuras de cartão
As parcelas com `payment_date` em abril-agosto estão com `transaction_status: Pago`. A linha 2233 do webhook faz `detail.due_date <= today` sem considerar que é cartão de crédito (que deveria ser sempre "Pendente"). Solução: forçar "Pendente" quando `creditCardId` existe.

### 4. Vencimento não aparece no card
O card só mostra `competence_date`. Para cartão de crédito, o `payment_date` (vencimento da fatura) é a informação mais relevante e deve ser exibida.

## Plano de Implementação

### Etapa 1: Página AnalisesEva.tsx — Agrupar parcelas por series_id

**No componente principal:**
- Agrupar `pendingTransactions` por `series_id` (quando existir)
- Para itens com `series_id`, renderizar um **card-mãe** mostrando:
  - Descrição sem o sufixo "(X/N)"
  - Valor total (soma de todas as parcelas)
  - Badge "6x parcelas" (ou quantidade correspondente)
  - Lista colapsável (accordion) com cada parcela: número, valor individual, data de vencimento
  - Botões "Aprovar Todas" e "Rejeitar Todas"
- Para itens sem `series_id`, manter o card individual atual

**No hook `useAIPendingTransactions.ts`:**
- Adicionar função `approveAll` que aprova todas as parcelas de uma série de uma vez (loop ou batch)

### Etapa 2: Mostrar vencimento (payment_date) no card

- Adicionar no card a exibição do `payment_date` quando for diferente de `competence_date`
- Para cartão de crédito: mostrar "Vencimento: DD/MM/YYYY" com ícone de calendário

### Etapa 3: Webhook — Corrigir datas e status de parcelas

**Em `whatsapp-webhook/index.ts`:**

**Correção de ano (validação de sanidade):**
- Após definir `competenceDate`, verificar se o ano é menor que o ano atual. Se for, corrigir para o ano atual.
- Mesma validação para `paymentDate` e `detail.due_date`.

**Correção de status para parcelas de cartão (linha ~2233):**
- Mudar de:
  ```
  transaction_status: (detail.due_date && detail.due_date <= today) ? "Pago" : "Pendente"
  ```
- Para:
  ```
  transaction_status: creditCardId ? "Pendente" : (detail.due_date && detail.due_date <= today) ? "Pago" : "Pendente"
  ```

**Cálculo de `payment_date` por parcela em cartão:**
- Quando `creditCardId` existe e há parcelas, calcular o `payment_date` de cada parcela usando o ciclo do cartão (closing_day/due_day), incrementando mês a mês a partir da competência.

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/AnalisesEva.tsx` | Agrupar por `series_id`, card com accordion de parcelas, mostrar `payment_date` |
| `src/hooks/useAIPendingTransactions.ts` | Adicionar `approveAll` para aprovar série inteira |
| `supabase/functions/whatsapp-webhook/index.ts` | Validação de ano, status cartão em parcelas, cálculo de vencimento por parcela |

