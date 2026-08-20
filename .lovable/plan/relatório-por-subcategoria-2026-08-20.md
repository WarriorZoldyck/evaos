# Relatório por subcategoria

## O problema (verificado no código)

Hoje o filtro de categoria em Lançamentos lista apenas categorias de 1º nível (`rootCategories` em `TransactionFilters.tsx`) e a consulta só compara a coluna `category` do lançamento, incluindo no máximo os filhos diretos (`useTransactions.ts`). Como "Eventos" está gravada em `subcategory` (sob "Operacionais"), não existe forma de puxar só ela.

Nos relatórios (DRE e Fluxo de Caixa) as subcategorias aparecem na árvore, mas não é possível isolar uma subcategoria nem exportar apenas ela.

## O que será feito

### 1. Filtro por qualquer nível em Lançamentos
- O seletor de categoria passa a mostrar a árvore completa (categoria > subcategoria > sub-subcategoria), com busca por nome.
- Ao escolher "Eventos", o filtro considera lançamentos em que ela apareça em qualquer nível (`category`, `subcategory` ou `subcategory2`), incluindo os filhos dela.
- A exportação existente de Lançamentos (CSV/PDF/Excel) já respeita os filtros, então o relatório de "saídas de julho / Eventos" sai direto daí.

### 2. Detalhar subcategoria nos relatórios
- Em DRE e Fluxo de Caixa, cada linha da árvore (inclusive subcategorias) ganha ação "Ver lançamentos", que abre Lançamentos já filtrado por aquela subcategoria + período + tipo.
- O botão "Exportar" ganha a opção de exportar apenas o ramo selecionado (a subcategoria e seus filhos), nos mesmos formatos CSV, PDF e Excel.

## Detalhes técnicos

- `src/components/lancamentos/TransactionFilters.tsx`: substituir a lista de raízes por navegação hierárquica com caminho ("Operacionais › Eventos").
- `src/hooks/useTransactions.ts`: ampliar a cláusula `or` para `category/subcategory/subcategory2` com IDs e nomes (mantendo compatibilidade híbrida UUID/texto) e descendentes recursivos, não só filhos diretos.
- `src/components/relatorios/CategoryReportTable.tsx` e `DRETable*.tsx`: ação por linha navegando para `/lancamentos` com query params de categoria/período/tipo.
- `src/components/relatorios/ExportReportButton.tsx`: aceitar um subconjunto de linhas para exportar o ramo escolhido.
