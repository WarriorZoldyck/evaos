

# Fix: D+2 = Sempre Lump Sum (Pagamento Único)

## Problema

A migration anterior resetou `auto_anticipation = false` em todos os terminais. Mas o comportamento correto é: **D+2 sempre credita tudo de uma vez** (lump sum). Não depende de um flag — é inerente ao prazo curto de liquidação. Só terminais D+30 pagam em parcelas separadas.

O MdrInfoCard e o save logic estão mostrando/criando 10 parcelas separadas para REDE (D+2) porque `auto_anticipation = false`.

## Solução

Remover a dependência do flag `auto_anticipation` e usar a lógica direta:

- **`settlement_days_credit < 30`** → Lump sum (1 transação, valor total líquido, creditado em D+X)
- **`settlement_days_credit >= 30`** → Parcelas separadas (N transações, intervalo 30 dias + D+X)

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `TransactionFormModal.tsx` (linha 622-624) | Trocar `autoAnticipation` por `settlementDays < 30` |
| `MdrInfoCard.tsx` (linha 68-70) | Mesma troca: `settlementDays < 30` em vez de `auto_anticipation` |

### Código

```typescript
// ANTES
const autoAnticipation = (selectedTerminal as any).auto_anticipation ?? false;
if (autoAnticipation) { /* lump sum */ }

// DEPOIS
const isLumpSum = settlementDays < 30;
if (isLumpSum) { /* lump sum */ }
```

Ambos os arquivos usam a mesma condição, então a mudança é simétrica.

