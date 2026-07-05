## Problema

Quando existe alguma venda em cartão no período, o modal mostra as colunas Bruto/MDR/Líquido. Nas linhas de "Outros" (boleto, pix, dinheiro, etc.) a coluna **Bruto** aparece como "—" porque a lógica só preenche Bruto quando `hasGross = true` (ou seja, quando há MDR).

Para vendas sem MDR, Bruto e Líquido são iguais — deve mostrar o valor, não "—".

## Correção (apenas apresentação)

`src/components/dashboard/FaturamentoDetailModal.tsx`

1. **Aba Lista**: coluna Bruto passa a exibir sempre `formatCurrency(l.gross)` (que já é igual ao net quando não há MDR). Coluna MDR continua "—" para não-cartão.
2. **GroupTable** (Por mês / Por categoria / Por cliente): coluna Bruto exibe sempre `formatCurrency(r.gross)` — já é o comportamento atual, sem mudança.
3. **Sub-dialog de detalhes**: já cobre isso (Bruto só é exibido quando há MDR). Ajuste: quando não há MDR, mostrar um card "Valor" no lugar do "Bruto/MDR" para não confundir. Mantém "Líquido" e "Parcelas".

Nenhuma alteração em cálculos, banco ou outras telas.
