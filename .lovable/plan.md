

# Fix: Preview de Parcelas com Maquininha — Valor e Datas Incorretos

## Problema

Quando um lançamento parcelado é criado via maquininha (terminal), a tabela de preview de parcelas (`InstallmentPreviewTable`) mostra:

1. **Valor cheio (bruto)** em cada parcela — deveria mostrar o valor líquido (após desconto MDR)
2. **Intervalo mensal** entre parcelas — deveria usar D+30 (dias corridos baseado em `settlement_days_credit`)

A gravação funciona corretamente (linhas 610-644 do `TransactionFormModal.tsx` calculam net e usam `addDays`), mas o **preview** não reflete essa lógica.

## Causa Raiz

No `MainFormContent` (linha 1593-1605), o `InstallmentPreviewTable` recebe:
- `totalAmount={watchAmount}` → valor bruto, sem deduzir MDR
- `intervalType="monthly"` → usa `addMonths` em vez de `addDays(settlement_days)`

O componente de preview não tem conhecimento do terminal selecionado nem da taxa MDR.

## Correção

### 1. `TransactionFormModal.tsx` — Passar dados do terminal ao preview

No `MainFormContent`:
- Ler `card_terminal_id` do form
- Encontrar o terminal selecionado em `cardTerminals`
- Se houver terminal com crédito parcelado:
  - Calcular o `totalAmount` como valor líquido total (gross - MDR total)
  - Forçar `intervalType` para `custom_days` com `customDays = settlement_days_credit` (tipicamente 30)
- Passar esses valores ajustados ao `InstallmentPreviewTable`

Isso alinha o preview com a lógica de gravação (linhas 610-644), sem alterar o componente `InstallmentPreviewTable` em si.

### Arquivos alterados
- `src/components/lancamentos/TransactionFormModal.tsx` — ajustar valores passados ao `InstallmentPreviewTable` quando há terminal selecionado

