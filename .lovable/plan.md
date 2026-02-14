

## Correção: Taxa MDR na criação de transações via maquininha

### Problema

Ao salvar uma transação via maquininha com parcelamento, o sistema busca a taxa específica de parcelas (ex: 6% para 4x) e calcula o valor líquido como R$9.400. Mas o correto é usar a taxa de crédito à vista (3,29%), resultando em R$9.671.

Para o lojista, o valor recebido da adquirente é baseado na taxa de crédito à vista, independente de como o cliente escolheu parcelar.

### Alteração

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx` (linhas 430-440)

Remover a busca de taxa por parcelas e sempre usar `credit_rate` para crédito:

```text
ANTES:
  Se débito → usa debit_rate
  Se crédito parcelado → busca rates_info por número de parcelas
  Se crédito à vista → usa credit_rate

DEPOIS:
  Se débito → usa debit_rate
  Se crédito (qualquer) → usa credit_rate
```

Também salvar `installments_total` junto com `installments` (linhas 488-490), para que o modal de detalhes fique consistente.

**Mesma correção no MdrInfoCard e TransactionDetailModal**, que recalculam o MDR para exibição -- ambos devem usar a mesma lógica (crédito à vista sempre).

### Arquivos alterados

1. `src/components/lancamentos/TransactionFormModal.tsx` -- lógica de cálculo ao salvar + salvar installments_total
2. `src/components/lancamentos/MdrInfoCard.tsx` -- preview do MDR no formulário
3. `src/components/lancamentos/TransactionDetailModal.tsx` -- exibição do MDR nos detalhes

### Dados existentes

Transações já salvas com taxa errada podem ser corrigidas via Cloud View > Run SQL (opcional).
