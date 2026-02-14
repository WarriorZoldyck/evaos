

## Revisão Completa das Projeções e Cálculos

### Resultado da Auditoria

| Area | Status | Detalhes |
|---|---|---|
| Projecao de Saldo (grafico) | OK | Usa `payment_date` corretamente, inclui saldos iniciais |
| Entrada Prevista (card) | OK | Corrigido na ultima alteracao - soma pendentes por `payment_date` |
| Saida Prevista (card) | OK | Adicionado na ultima alteracao |
| Faturamento (card) | OK | Usa `competence_date` + `installment_number === 1` com `original_amount` |
| Taxas MDR (maquininha) | OK | Calcula taxa, valor liquido, D+ corretamente |
| Ciclo cartao de credito | OK | Fechamento/vencimento calculados corretamente |
| Recorrentes na projecao | OK | Ocorrencias virtuais usam `payment_date` |
| **Parcelas: competence_date** | **BUG** | Espalha competencia mes a mes (deveria ser fixa) |
| **Recorrentes: competence_date** | **BUG** | Mesmo problema das parcelas |

---

### Bug 1: Parcelas espalham competence_date (critico)

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx` (linha 510)

Quando um servico de R$ 15.200 e prestado em Janeiro e parcelado em 4x, o sistema gera:

```text
ATUAL (errado):
  Parcela 1 -> competence: Jan, payment: Fev
  Parcela 2 -> competence: Fev, payment: Mar   <-- ERRADO
  Parcela 3 -> competence: Mar, payment: Abr   <-- ERRADO
  Parcela 4 -> competence: Abr, payment: Mai   <-- ERRADO

CORRETO:
  Parcela 1 -> competence: Jan, payment: Fev
  Parcela 2 -> competence: Jan, payment: Mar
  Parcela 3 -> competence: Jan, payment: Abr
  Parcela 4 -> competence: Jan, payment: Mai
```

**Correcao:** Linha 510, trocar `addMonths(data.competence_date, i)` por `data.competence_date`.

Isso garante que o faturamento inteiro apareca no mes do servico, e cada parcela so afete o fluxo de caixa no mes do seu vencimento.

### Bug 2: Recorrentes espalham competence_date

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx` (linha 552)

Mesma logica: ao criar lancamentos recorrentes, o `competence_date` tambem e incrementado junto com o `payment_date`. Para recorrentes, cada ocorrencia e um servico independente, entao aqui o comportamento correto depende do caso:

- Se e uma assinatura mensal (ex: aluguel), cada mes TEM sua propria competencia -- nesse caso o comportamento atual esta correto.
- Se e um servico unico pago de forma recorrente, deveria ser fixo.

Como recorrentes representam obrigacoes periodicas (aluguel, assinatura, etc.), o comportamento atual **esta correto** para esse caso. Vou manter como esta.

**Conclusao: apenas 1 correcao e necessaria.**

### Alteracao

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx`
- Linha 510: trocar `const compDate = addMonths(data.competence_date, i);` por `const compDate = data.competence_date;`

Essa e a unica mudanca necessaria. Todas as outras projecoes, taxas e calculos estao corretos.

### Dados existentes

Parcelas ja criadas no banco podem ter `competence_date` espalhada. Opcionalmente, o usuario pode executar via Cloud View > Run SQL:

```sql
UPDATE transactions SET competence_date = (
  SELECT t2.competence_date FROM transactions t2
  WHERE t2.series_id = transactions.series_id
  AND t2.installment_number = 1
)
WHERE series_id IS NOT NULL
AND installment_number > 1;
```

