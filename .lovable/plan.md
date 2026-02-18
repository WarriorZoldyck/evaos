

## Correção de 2 Bugs no Modal de Lançamentos

### Bug 1: Maquininhas nao atualizam ao trocar contexto dentro do modal

**Problema:** Quando o usuario troca o contexto (Pessoal -> Empresa) dentro do modal, as contas bancarias, carteiras e cartoes sao filtrados corretamente pelo `formCompanyId`, mas as **maquininhas (cardTerminals)** continuam mostrando as do contexto global anterior. Isso acontece porque o codigo filtra `bankAccounts`, `wallets` e `creditCards` a partir de `allAccounts`, mas nao faz o mesmo para `cardTerminals`.

**Solucao:**
- No `useTransactions.ts`: buscar **todas** as maquininhas (sem filtro de empresa) no `fetchAllAccounts`, similar ao que ja e feito para contas/carteiras/cartoes, armazenando em `allCardTerminals`.
- No `TransactionFormModal.tsx`: filtrar `cardTerminals` pelo `formCompanyId` da mesma forma que ja se faz com `filteredBankAccounts`, `filteredWallets` e `filteredCreditCards`. Passar o resultado filtrado para o componente `PaymentMethodFields`.

**Arquivo: `src/hooks/useTransactions.ts`**
- Adicionar fetch de todos os `card_terminals` (sem company filter) no `fetchAllAccounts`
- Expor `allCardTerminals` no retorno do hook

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**
- Criar `filteredCardTerminals` filtrando `allCardTerminals` pelo `formCompanyId`
- Passar `filteredCardTerminals` para `PaymentMethodFields` e para a logica de submit

---

### Bug 2: Valor liquido salvo ignora taxa de parcelamento (rates_info)

**Problema:** O `MdrInfoCard` (UI) busca corretamente a taxa por numero de parcelas em `rates_info`, mas a logica de submit (linhas 462-484) sempre usa `credit_rate` (taxa a vista). Isso faz com que o valor liquido salvo no banco use a taxa errada.

**Solucao:**
- Na funcao `handleMainSubmit`, replicar a mesma logica do `MdrInfoCard`: quando a transacao e parcelada, buscar a taxa correspondente em `rates_info` do terminal. Usar `credit_rate` apenas como fallback.

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**
- Na secao de calculo de taxa MDR (linhas 462-484), adicionar:
  - Verificar se `is_installment` e `installments_count >= 2`
  - Parsear `rates_info` do terminal selecionado
  - Buscar a taxa correspondente ao numero de parcelas
  - Usar `credit_rate` como fallback caso nao encontre

Trecho de logica atualizado:
```text
if (isDebit) {
  rate = selectedTerminal.debit_rate ?? 0;
} else {
  // Check installment-specific rate from rates_info
  const fallbackRate = selectedTerminal.credit_rate ?? 0;
  if (data.is_installment && data.installments_count && data.installments_count >= 2) {
    const rates = parseRatesInfo(selectedTerminal.rates_info);
    const match = rates.find(r => r.installments === data.installments_count);
    rate = match ? match.rate : fallbackRate;
  } else {
    rate = fallbackRate;
  }
}
```

- Adicionar (ou importar) a funcao `parseRatesInfo` no arquivo do modal.

---

### Resumo das alteracoes

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useTransactions.ts` | Buscar todas as maquininhas sem filtro de empresa e expor `allCardTerminals` |
| `src/components/lancamentos/TransactionFormModal.tsx` | Filtrar maquininhas por `formCompanyId`; usar taxa de `rates_info` no submit |
| `src/components/layout/GlobalTransactionModal.tsx` | Passar `allCardTerminals` como prop |

