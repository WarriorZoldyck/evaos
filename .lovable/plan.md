

## Reestruturar DRE para formato multi-colunas mensais

### O que muda

Atualmente o DRE mostra apenas 1 coluna de valor (total do periodo selecionado). A referencia mostra um formato de tabela onde:
- Cada **coluna** e um mes (Janeiro, Fevereiro, Marco...)
- Cada **linha** e uma categoria, expandivel para subcategorias
- O filtro controla o **ano** e a **granularidade** (Mensal/Trimestral/Semestral)
- Linhas de totalizacao intermediarias (Receita Bruta, Lucro Bruto, Resultado) ficam entre as categorias

### Layout proposto

```text
Filtros: [Conta v] [Mensal v]  < 2026 >  [Gerar relatorio]

| Categoria                    | Jan     | Fev     | Mar     | Abr     | Mai     | Jun     |
|------------------------------|---------|---------|---------|---------|---------|---------|
| + Receitas                   | 1.000   | 2.000   | 1.500   |   800   | 1.200   | 3.000   |
|     Vendas                   |   800   | 1.500   | 1.000   |   500   |   900   | 2.500   |
|     Servicos                 |   200   |   500   |   500   |   300   |   300   |   500   |
| + Despesas                   |  -600   |  -800   |  -700   |  -400   |  -500   |  -900   |
|     Aluguel                  |  -300   |  -300   |  -300   |  -300   |  -300   |  -300   |
|     Marketing                |  -300   |  -500   |  -400   |  -100   |  -200   |  -600   |
| = RESULTADO                  |   400   | 1.200   |   800   |   400   |   700   | 2.100   |
```

### Alteracoes tecnicas

**1. Novo filtro de periodo para DRE (`src/components/relatorios/DREPeriodFilter.tsx`)**

Substituir o `PeriodFilter` atual por um filtro especifico:
- Seletor de granularidade: Mensal (padrao)
- Navegacao por ano: setas `<` `2026` `>` com dropdown
- Seletor de conta bancaria (ja existe)
- O filtro define: ano selecionado + granularidade

**2. Novo hook `src/hooks/useDREData.ts`**

Hook dedicado que:
- Recebe: ano, granularidade, accountId
- Busca todas as transacoes do ano inteiro de uma vez (competence_date entre 01/jan e 31/dez)
- Busca categorias (como ja faz)
- Agrupa transacoes por mes E por categoria hierarquica
- Retorna uma estrutura tipo:

```typescript
interface DRECategoryRow {
  categoryId: string;
  categoryName: string;
  monthlyTotals: Record<string, number>; // chave = "2026-01", "2026-02", etc.
  children: DRECategoryRow[];
}

interface DREData {
  months: string[]; // ["2026-01", "2026-02", ...]
  revenueRows: DRECategoryRow[];
  expenseRows: DRECategoryRow[];
  monthlyRevenueTotals: Record<string, number>;
  monthlyExpenseTotals: Record<string, number>;
  monthlyResults: Record<string, number>;
  loading: boolean;
}
```

**3. Novo componente de tabela `src/components/relatorios/DRETable.tsx`**

Tabela com:
- Header fixo: Categoria | Jan | Fev | Mar | ... | Jun (6 meses por semestre, ou 12 por ano)
- Scroll horizontal se necessario
- Linhas de categoria expandiveis (recursivo, como ja implementado)
- Linhas de totalizacao com background destacado (Receitas, Despesas, Resultado)
- Valores formatados em BRL
- Cores: verde para receitas, vermelho para despesas, cor condicional para resultado

**4. Atualizar `src/pages/DRE.tsx`**

- Substituir `PeriodFilter` pelo novo `DREPeriodFilter`
- Substituir `CategoryReportTable` pela nova `DRETable`
- Usar o novo hook `useDREData` em vez de `useCashFlowData`
- Manter a secao "Como funciona?" existente

### Arquivos

- **Criar**: `src/hooks/useDREData.ts`
- **Criar**: `src/components/relatorios/DREPeriodFilter.tsx`
- **Criar**: `src/components/relatorios/DRETable.tsx`
- **Modificar**: `src/pages/DRE.tsx`
- **Manter sem alteracao**: `src/hooks/useCashFlowData.ts` e `CategoryReportTable.tsx` (usados pelo Plano de Caixa)

