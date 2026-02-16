

## Fluxo de Caixa e DRE -- Implementacao Completa

Transformar as paginas placeholder "Plano de Caixa" e "DRE" em relatorios financeiros funcionais com dados reais do banco de dados.

### Conceitos

- **Plano de Caixa**: Relatorio por **regime de caixa** (data de pagamento). Mostra o dinheiro que de fato entrou e saiu.
- **DRE por Competencia**: Relatorio por **regime de competencia** (data de competencia). Mostra receitas e despesas reconhecidas no periodo, independente de quando foram pagas.

Ambos compartilham a mesma estrutura visual: categorias hierarquicas agrupadas (pai > filhos), com totalizadores.

---

### Estrutura Visual (ambos os relatorios)

```text
+--------------------------------------------------+
| Titulo + Filtro de Periodo (PeriodFilter)        |
+--------------------------------------------------+
| RECEITAS                              | Total R$ |
|   Categoria Pai 1                     |   X.XXX  |
|     Subcategoria A                    |     XXX  |
|     Subcategoria B                    |     XXX  |
|   Categoria Pai 2                     |   X.XXX  |
| TOTAL RECEITAS                        |  XX.XXX  |
+--------------------------------------------------+
| DESPESAS                              | Total R$ |
|   Categoria Pai 1                     |   X.XXX  |
|     Subcategoria A                    |     XXX  |
|   Categoria Pai 2                     |   X.XXX  |
| TOTAL DESPESAS                        |  XX.XXX  |
+--------------------------------------------------+
| RESULTADO (Receitas - Despesas)       |  XX.XXX  |
+--------------------------------------------------+
```

Categorias colapsaveis: clicar na categoria pai expande/colapsa as subcategorias.

---

### Diferenca entre os dois relatorios

| Aspecto | Plano de Caixa | DRE |
|---|---|---|
| Data filtrada | `payment_date` | `competence_date` |
| Status incluido | Apenas `Pago` | Todos (Pago + Pendente) |
| Titulo | "Plano de Caixa" | "DRE por Competencia" |
| Subtitulo | "Regime de caixa" | "Regime de competencia" |

---

### Arquivos criados/modificados

1. **`src/hooks/useCashFlowData.ts`** (novo)
   - Hook reutilizavel que recebe o modo (`caixa` ou `competencia`) e os filtros de periodo
   - Busca transacoes filtradas pela data correta (payment_date ou competence_date)
   - Busca categorias e monta a arvore hierarquica
   - Agrupa valores por categoria pai e filhos
   - Retorna: receitas por categoria, despesas por categoria, totais, loading

2. **`src/components/relatorios/CategoryReportTable.tsx`** (novo)
   - Componente de tabela reutilizavel para ambos os relatorios
   - Recebe dados agrupados por categoria (receitas e despesas)
   - Linhas colapsaveis para categorias pai
   - Formatacao em Reais (R$)
   - Linha de total receitas, total despesas e resultado final
   - Cores: receitas em verde, despesas em vermelho, resultado conforme positivo/negativo

3. **`src/pages/PlanoDeCaixa.tsx`** (reescrito)
   - Usa `useCashFlowData("caixa", filters)`
   - Inclui PeriodFilter e filtro por conta bancaria
   - Renderiza `CategoryReportTable`

4. **`src/pages/DRE.tsx`** (reescrito)
   - Usa `useCashFlowData("competencia", filters)`
   - Inclui PeriodFilter e filtro por conta bancaria
   - Renderiza `CategoryReportTable`

---

### Detalhes tecnicos

**Hook `useCashFlowData`:**
- Recebe `mode: "caixa" | "competencia"` e `filters: DashboardFilters`
- Modo "caixa": filtra por `payment_date`, somente status `Pago`
- Modo "competencia": filtra por `competence_date`, todos os status
- Busca categorias do contexto atual (empresa/pessoal) para montar a hierarquia
- Agrupa transacoes por `category` (UUID), resolve nome via tabela de categorias
- Monta estrutura: `{ categoryId, categoryName, total, children: [{ name, total }] }`
- Aplica filtro por conta bancaria (incluindo cartoes vinculados, como no Dashboard)
- Respeita contexto empresa/pessoal via `companyFilter`

**Componente `CategoryReportTable`:**
- Props: `revenueGroups`, `expenseGroups`, `loading`
- Cada grupo pai e clicavel (toggle expand/collapse usando estado local)
- Subcategorias indentadas com padding-left
- Linhas de total com fundo destacado e fonte bold
- Linha de resultado final com cor dinamica (verde se positivo, vermelho se negativo)

**Reutilizacao:**
- `PeriodFilter` ja existente, reutilizado diretamente
- Filtro de conta bancaria igual ao Dashboard
- Patterns de company filter ja existentes no codebase

Nenhuma alteracao no banco de dados e necessaria.

