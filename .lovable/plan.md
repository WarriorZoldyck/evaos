# Precificação — remover Decomposição e Comparativo, simulador logo abaixo do procedimento

## O que muda

1. **Remover a "Decomposição — {procedimento}"** por completo (informação redundante com a tabela e o simulador).
2. **Remover o "Comparativo de Procedimentos"** (os dois gráficos).
3. **Simulador logo abaixo do procedimento selecionado**: ao clicar numa linha da tabela, o painel do simulador aparece imediatamente abaixo da tabela de procedimentos, em largura total, em vez de na coluna lateral. Sem procedimento selecionado, aparece uma mensagem curta pedindo para selecionar um.

O layout de duas colunas (tabela + coluna lateral) deixa de existir na seção de procedimentos: tabela em largura total, simulador abaixo dela.

## Detalhes técnicos

- `src/pages/Precificacao.tsx`: remover imports e uso de `ProcedureBreakdownV2` e `ProcedureComparisonChart`; desfazer o grid lateral e renderizar `ProcedureSimulator` abaixo do card de procedimentos quando houver `selectedProcedure`.
- `src/pages/PrecificacaoV2.tsx`: remover o uso de `ProcedureBreakdownV2` (mesma posição para o simulador, se aplicável).
- Excluir os arquivos `src/components/precificacao-v2/ProcedureBreakdownV2.tsx` e `src/components/precificacao-v2/ProcedureComparisonChart.tsx`.
- Cálculos em `usePricingV2` permanecem intactos.
