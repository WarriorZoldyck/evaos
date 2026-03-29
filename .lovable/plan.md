

# Correção da Importação de Fatura — Valores e Distribuição por Cartão

## Problemas Encontrados

### 1. Importações duplicadas no banco
- **3/28**: 115 transações = R$ 40.111,30
- **3/29**: 102 transações = R$ 38.112,32
- **Total no banco**: 217 transações = R$ 78.223,62
- **Todas no cartão 7014** (nenhuma nos filhos 5178, 7239, 8021)

### 2. Valores inflados por entradas indevidas
A última importação (102 tx) contém:
- **4 receitas** (R$ 19.225,79) — incluem "DEB AUTOM DE FATURA EM C/" (R$ 19.075,85) que é o pagamento da fatura anterior, **não é transação real**
- **98 despesas** (R$ 18.886,53)
- Total bruto: R$ 38.112,32 — quase o dobro do valor real da fatura (R$ 20.739,08)

O prompt da IA já diz "Do NOT include payment summaries" mas a IA incluiu mesmo assim.

### 3. Cartões filhos não estão sendo atribuídos
O código do modal ainda está mandando tudo para o cartão principal (7014). Os cartões 5178, 7239 e 8021 não receberam nenhuma transação.

### 4. payment_date não alinhada com a fatura
As transações mostram a data de compra como `payment_date` ao invés da data de vencimento da fatura.

## Plano de Correção

### Passo 1 — Limpar dados duplicados
Excluir TODAS as transações importadas da Paula (ambos os lotes de 3/28 e 3/29) para reimportar limpo:
```sql
DELETE FROM transactions 
WHERE user_id = '...' AND external_id LIKE 'import_%' 
AND credit_card_id = 'd1ef5ba8-...';
```

### Passo 2 — Melhorar o prompt da IA (edge function)
Reforçar no prompt do `parse-bank-statement`:
- **Excluir explicitamente**: "DEB AUTOM DE FATURA", pagamentos anteriores, créditos de estorno que não são compras
- Adicionar regra: "Entries like 'DEB AUTOM DE FATURA' or 'PAGAMENTO FATURA' are bill payments, NOT transactions — exclude them"

### Passo 3 — Distribuir transações por cartão real (modal)
No `ImportStatementModal.tsx`, ao fazer o match de `detected_card_digits` com os cartões do sistema:
- Usar o `card.id` real (filho) ao invés de `card.parent_card_id`
- Garantir que cada transação receba o `credit_card_id` do cartão correspondente aos seus dígitos

### Passo 4 — Alinhar payment_date com vencimento da fatura
Para importações de cartão, setar `payment_date` = `statement_due_date` (vencimento) e `competence_date` = data de compra original.

### Passo 5 — Validação pós-correção
Após reimportação:
- Verificar que o total de despesas bate com R$ 20.739,08 da fatura
- Verificar distribuição: 7014, 5178, 7239, 8021 cada um com suas transações
- Confirmar que não há entradas de pagamento/crédito de fatura

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/parse-bank-statement/index.ts` | Reforçar exclusão de pagamentos de fatura no prompt |
| `src/components/lancamentos/ImportStatementModal.tsx` | Atribuir cartão real (não pai); alinhar payment_date |
| Migration SQL | Limpar lotes duplicados da Paula |

