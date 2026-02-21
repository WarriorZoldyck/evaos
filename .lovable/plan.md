
## Edicao de Parcelas Individuais -- Criacao e Edicao

### Resumo
Expandir o sistema de parcelas para permitir editar o valor de **qualquer** parcela (nao so a primeira), tanto na criacao quanto na edicao de lancamentos. Ao alterar qualquer valor, perguntar se quer distribuir a diferenca entre as demais parcelas.

### 1. InstallmentPreviewTable (criacao) -- todas as parcelas editaveis

**Arquivo:** `src/components/lancamentos/InstallmentPreviewTable.tsx` (alterar)

Mudancas:
- Trocar props `firstInstallmentAmount` / `onFirstInstallmentChange` por `customAmounts: Record<number, number>` e `onCustomAmountsChange`
- Quando juros = 0, TODAS as parcelas terao Input editavel (nao so a 1a)
- Ao editar qualquer parcela, checkbox "Distribuir diferenca nas demais parcelas" aparece
- Se distribuir marcado: recalcula as parcelas nao editadas para que o total bata
- Se desmarcado: demais mantem valor padrao (total / n)

### 2. SeriesInstallmentTable (edicao de serie existente) -- novo componente

**Arquivo:** `src/components/lancamentos/SeriesInstallmentTable.tsx` (criar)

- Recebe `seriesId` e busca todas as transacoes da serie no banco via Supabase
- Exibe tabela: N, Vencimento, Valor, Status (Pago/Pendente)
- Parcelas "Pago": valor somente leitura, fundo diferenciado
- Parcelas "Pendente": valor editavel via Input inline
- Checkbox "Distribuir diferenca nas demais parcelas pendentes" ao alterar qualquer valor
- Comunica alteracoes via callback `onAmountsChanged: (updates: Array<{ id: string; amount: number }>) => void`

### 3. TransactionFormModal -- integracao

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx` (alterar)

- **Criacao**: adaptar integracao com `InstallmentPreviewTable` para usar `customAmounts` (mapa) em vez de `firstInstallmentAmount` (valor unico). Ajustar submit para gerar parcelas com valores individuais do mapa
- **Edicao**: quando a transacao tem `series_id` e `installments_total > 1`, mostrar `SeriesInstallmentTable` na secao de parcelamento. No submit, chamar `updateMultipleTransactions` com as parcelas modificadas

### 4. useTransactions -- funcao de update em lote

**Arquivo:** `src/hooks/useTransactions.ts` (alterar)

- Adicionar `updateMultipleTransactions(updates: Array<{ id: string; amount: number }>)` que atualiza o campo `amount` de multiplas transacoes de uma vez via Supabase

### 5. Lancamentos -- passar handler

**Arquivo:** `src/pages/Lancamentos.tsx` (alterar)

- Passar `updateMultipleTransactions` como prop para o `TransactionFormModal`

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/lancamentos/InstallmentPreviewTable.tsx` | Alterar (todas parcelas editaveis, novo formato customAmounts) |
| `src/components/lancamentos/SeriesInstallmentTable.tsx` | Criar (tabela de edicao de serie existente) |
| `src/components/lancamentos/TransactionFormModal.tsx` | Alterar (integrar ambos componentes) |
| `src/hooks/useTransactions.ts` | Alterar (adicionar updateMultipleTransactions) |
| `src/pages/Lancamentos.tsx` | Alterar (passar nova funcao ao modal) |
