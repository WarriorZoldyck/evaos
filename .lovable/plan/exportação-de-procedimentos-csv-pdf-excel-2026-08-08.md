# Exportação de Procedimentos (CSV, PDF, Excel)

## O que muda

Na página de Precificação, o botão "Exportar CSV" vira **"Exportar"**, com um menu de três opções:

- **CSV** (comportamento atual de download, já funciona bem)
- **PDF** (tabela formatada, paisagem, com título e data)
- **Excel** (.xlsx, com cabeçalho em negrito e larguras de coluna ajustadas)

O conteúdo exportado passa a ser **apenas a seção de Procedimentos**. As seções de configuração, resumo de custos e detalhamento de despesas saem do arquivo.

## Colunas exportadas

Nome, Qtd, Tempo (h), Lucratividade %, Preço, CF, CV, NF, Lucro, Lucro/h — na mesma ordem exibida na tabela da tela, com valores em formato brasileiro.

Nome do arquivo: `procedimentos_AAAA-MM-DD.csv|pdf|xlsx`.

## Detalhes técnicos

- `src/components/precificacao-v2/ExportPricingButton.tsx`: substituir o `Button` único por um `DropdownMenu` (shadcn já disponível) com os três itens; extrair a montagem das linhas de procedimento em uma função única reutilizada pelos três formatos.
- PDF: usar `jspdf` + `jspdf-autotable`, já instalados.
- Excel: adicionar a dependência `xlsx` (SheetJS) para gerar o `.xlsx` no cliente.
- Remover as props que deixam de ser usadas (`costItems`, `groupTotals`, `custoHora`, `fmm`, `hoursPerMonth`, `numRooms`) e ajustar a chamada em `src/pages/Precificacao.tsx`.
- Manter os toasts de sucesso/erro e o estado de carregamento por formato.
