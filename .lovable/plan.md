

# Fix: Lógica de Terminal no Preview e Gravação de Parcelas

## Problemas Identificados

### 1. Débito (D+2) "jogando parcelado"
O switch "Parcelado?" está disponível mesmo para débito. Ao ativá-lo, o save (linha 646-653) grava metadata de parcelas (`installments`, `installments_total`) num registro único de débito — incorreto, pois débito é sempre à vista.

### 2. Valor errado no preview
O `terminalPreview` (linha 1150-1166) só ativa para **Cartão de Crédito com 2+ parcelas**. Para débito ou crédito 1x com terminal, retorna `null`, e o preview mostra valor bruto com datas mensais em vez de valor líquido com D+N.

### 3. D+2 "deu pau"
O preview para débito usa lógica padrão (mensal, sem MDR), gerando confusão. Além disso, o save para débito com `is_installment` ativo grava campos de parcelas desnecessários.

## Correções

### A. Esconder/desabilitar "Parcelado?" para Débito com terminal
Em `TransactionFormModal.tsx`, no bloco do switch "Parcelado?" (~linha 1528-1537): se o método de pagamento for "Cartão de Débito" **e** houver `card_terminal_id`, desabilitar o switch e forçar `is_installment = false`. Débito via maquininha é sempre à vista.

### B. Expandir `terminalPreview` para todos os cenários de terminal
Alterar o cálculo de `terminalPreview` (linhas 1149-1166) para:
- **Crédito 1x** (sem parcelas): calcular net total com `credit_rate`, `settlementDays = settlement_days_credit`
- **Crédito parcelado**: manter lógica atual (rate específica por parcela, D+30)
- **Débito**: calcular net com `debit_rate`, `settlementDays = settlement_days_debit`

Retornar um objeto com `{ netTotal, settlementDays, isDebit, isSinglePayment }` para que o preview saiba quando **não** mostrar tabela de parcelas (débito/crédito 1x).

### C. Ajustar exibição do preview
- Se `terminalPreview.isDebit` ou `terminalPreview.isSinglePayment`: **não** mostrar `InstallmentPreviewTable`. Em vez disso, mostrar um resumo simples (valor líquido, data de recebimento).
- Se crédito parcelado: manter preview atual com valores líquidos e D+30.

### D. Limpar save para débito (linha 646-653)
Remover o bloco que seta `installments`/`installments_total` para débito — não deve gravar metadata de parcelas em transação de débito.

### Arquivos alterados
- `src/components/lancamentos/TransactionFormModal.tsx`

