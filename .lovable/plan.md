

## Correção: Data D+ duplicada no modal de detalhes

### Problema

Quando uma transação é salva via maquininha, o `payment_date` já é calculado como D+N dias úteis a partir da `competence_date`. Porém, o modal de detalhes (`TransactionDetailModal.tsx`) recalcula D+N a partir do `payment_date`, fazendo contagem dupla:

```text
Salvar: competence 14/02 + D+2 = payment_date 17/02  (correto)
Modal:  payment_date 17/02 + D+2 = exibe 19/02       (errado, contagem dupla)
```

### Correção

**Arquivo:** `src/components/lancamentos/TransactionDetailModal.tsx` (linha 85)

Trocar o cálculo do `settlementDate` para usar `competence_date` em vez de `payment_date`:

```text
ANTES:
  settlementDate = addBusinessDays(payment_date, mdrDays)

DEPOIS:
  settlementDate = addBusinessDays(competence_date, mdrDays)
```

Com isso, o modal mostrará a mesma data que foi salva no `payment_date` (17/02), eliminando a inconsistência entre a listagem e o detalhe.

### Detalhes Técnicos

Alteração em uma única linha no arquivo `src/components/lancamentos/TransactionDetailModal.tsx`:

```typescript
// Linha 85 - usar competence_date ao invés de payment_date
const settlementDate = mdrDays > 0 
  ? addBusinessDays(new Date(t.competence_date + "T00:00:00"), mdrDays) 
  : null;
```

Nenhum outro arquivo precisa ser alterado. O `MdrInfoCard` no formulário já calcula corretamente a partir da data de competência.

