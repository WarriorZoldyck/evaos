

# Cartão por Número + Importação Parcelada no EVA IA

## Problemas Identificados

### 1. IA não reconhece cartão pelo número (apenas pelo nome)
No prompt da IA (linha 1157), os cartões já aparecem como `Nome Final 1234[UUID]`. Porém, quando a IA retorna `credit_card_id`, a resolução (linha 1726-1733) só faz match exato por UUID. Se a IA errar ou o usuário mencionar "cartão final 1234", e a IA não retornar o UUID correto, o sistema não faz fallback por últimos 4 dígitos.

**Solução**: Adicionar fallback de matching por `last_four_digits` quando `credit_card_id` não bate com nenhum cartão do contexto. Também melhorar o matching no `choose_account` (já funciona parcialmente na linha 661).

### 2. Importação de extrato de cartão com lançamentos parcelados
Atualmente, a importação de extratos (`ImportStatementModal`) cria lançamentos individuais — não agrupa parcelas nem cria `series_id`. Parcelamentos de cartão no extrato precisam ser detectados e agrupados.

**Solução**: Na importação, detectar padrões de parcelas no `description` (ex: "COMPRA X 3/6", "PARCELA 2/4") e agrupá-las sob um `series_id` compartilhado com `installment_number` e `installments_total`.

### 3. EVA IA — parcelas caindo como cards separados
Já resolvido anteriormente com `SeriesCard` agrupando por `series_id`. Confirmar que o fluxo de aprovação em lote (`approveAll`) preserva `series_id`, `installment_number`, `installments_total` e datas corretas por parcela.

## Etapas

### 1. Webhook — fallback de matching de cartão por últimos dígitos
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Após a verificação `if (aiParsed.credit_card_id)` na linha 1726, se não encontrar match, tentar:
- Extrair 4 dígitos de `aiParsed.credit_card_id` ou da mensagem original
- Buscar em `contextCards` por `last_four_digits`
- Se encontrar exatamente 1, usar esse cartão
- Se encontrar múltiplos, disparar `choose_account` com a lista

Também no `choose_account` (linha 658), melhorar o matching para aceitar apenas os 4 dígitos digitados (ex: usuário responde "1234").

### 2. Importação — agrupar parcelas em séries
**Arquivo**: `src/components/lancamentos/ImportStatementModal.tsx`

Na etapa de processamento pós-parse:
- Regex para detectar padrões como `(N/M)`, `PARC N/M`, `PARCELA N DE M` na descrição
- Agrupar transações com mesmo nome-base em séries
- Gerar `series_id` compartilhado, preencher `installment_number`, `installments_total`, `original_amount` (soma da série)
- Na UI, mostrar parcelas agrupadas visualmente antes da importação

### 3. Aprovação no hook — preservar dados de série
**Arquivo**: `src/hooks/useAIPendingTransactions.ts`

Verificar que `approveSingle` já passa `series_id`, `installment_number`, `installments_total` (já faz — linhas 69-73). Sem mudança necessária.

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Fallback de matching de cartão por últimos 4 dígitos |
| `src/components/lancamentos/ImportStatementModal.tsx` | Agrupar parcelas detectadas em séries com `series_id` |

