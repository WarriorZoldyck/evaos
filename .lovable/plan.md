

## Correções: Valor líquido errado + Settlement em dias úteis

### Problema 1: Transação existente com valor errado
A transação teste foi salva com R$9.400 (taxa de 6% parcelado) antes da correção. O código já foi corrigido para usar `credit_rate` (3,29%), mas o dado existente no banco precisa ser atualizado manualmente.

**Solução:** Executar via Cloud View > Run SQL (com ambiente **Test** selecionado):

```sql
-- Recalcula o valor líquido de transações com terminal usando credit_rate
UPDATE transactions t
SET amount = ROUND(t.original_amount - (t.original_amount * ct.credit_rate / 100), 2),
    installments_total = t.installments
FROM card_terminals ct
WHERE t.card_terminal_id = ct.id
  AND t.original_amount IS NOT NULL
  AND t.payment_method = 'Cartão de Crédito';
```

---

### Problema 2: Settlement date conta dias corridos em vez de dias úteis

Atualmente o sistema usa `addDays()` que conta dias corridos. Se uma venda é feita na sexta-feira com D+2, o sistema marca recebimento no domingo. O correto é pular fins de semana (sábado e domingo), marcando na terça-feira.

**Solução:** Criar uma função utilitária `addBusinessDays` e usá-la nos 3 pontos que calculam a data de liquidação.

### Arquivos alterados

1. **`src/lib/utils.ts`** -- Nova função `addBusinessDays(date, days)` que pula sábados e domingos
2. **`src/components/lancamentos/TransactionFormModal.tsx`** (linha 448) -- Trocar `addDays` por `addBusinessDays`
3. **`src/components/lancamentos/MdrInfoCard.tsx`** (linha 59) -- Trocar `addDays` por `addBusinessDays`
4. **`src/components/lancamentos/TransactionDetailModal.tsx`** (cálculo do `settlementDate`) -- Trocar `addDays` por `addBusinessDays`
5. **`supabase/functions/fix-terminal-transactions/index.ts`** -- Mesma lógica na edge function

### Detalhes técnicos

**Nova função em `src/lib/utils.ts`:**
```
addBusinessDays(date: Date, days: number): Date
  - Incrementa dia a dia
  - Pula sábado (6) e domingo (0)
  - Retorna a data após N dias úteis
```

**Exemplo:**
- Venda sexta 13/02, D+2 → terça 17/02 (pula sáb e dom)
- Venda segunda 09/02, D+2 → quarta 11/02 (sem mudança)

Nota: Feriados nacionais não são considerados nesta implementação (exigiria uma tabela de feriados). Apenas fins de semana são pulados, que é o padrão das adquirentes para o cálculo D+.

