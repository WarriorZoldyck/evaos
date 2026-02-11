

## Atualizacoes no Dashboard: Cards extras + Filtros melhorados

### 1. Novos cards "Entrada Consolidada / Prevista" e "Saida Consolidada / Prevista"

Abaixo da fileira atual de 4 cards (Faturamento, Entradas, Saidas, Saldo), adicionar mais 4 cards no mesmo estilo visual:

| Card | Valor | Cor |
|------|-------|-----|
| Entrada Consolidada | `consolidadoReceitas` (receitas pagas) | Verde |
| Entrada Prevista | `previstoReceitas` (receitas por competencia) | Verde claro/neutro |
| Saida Consolidada | `consolidadoSaidas` (despesas pagas) | Vermelho |
| Saida Prevista | `previstoSaidas` (despesas por competencia) | Vermelho claro/neutro |

Os dados ja existem no hook `useDashboardData` (campos `consolidadoReceitas`, `consolidadoSaidas`, `previstoReceitas`, `previstoSaidas`). A secao "Previsto vs Consolidado" com barras de progresso sera mantida ou removida conforme preferencia, ja que os novos cards substituem visualmente essa informacao.

**Arquivo:** `src/components/dashboard/SummaryCards.tsx`

### 2. Filtro de periodo no header: setas de navegacao por mes

Substituir o botao "Personalizado" por um controle de navegacao mensal:

- Botoes: Hoje | Semana | Mes | Ano
- Depois: seta esquerda `<` | "Fev 2026" (mes/ano atual) | seta direita `>`
- As setas avancam/retrocedem o mes
- Clicar no label do mes abre o calendario para selecao personalizada de range

**Arquivo:** `src/components/dashboard/PeriodFilter.tsx`
**Arquivo:** `src/hooks/useDashboardData.ts` (nenhuma mudanca necessaria, ja suporta `custom` com datas)

### 3. Botao "Ano todo" na Projecao de Saldo

Adicionar uma quarta opcao ao lado de 30/60/90 dias no grafico de projecao:

- Opcoes: 30 dias | 60 dias | 90 dias | Ano todo

O "Ano todo" calcula os dias restantes ate o final do ano e usa como horizonte de projecao.

**Arquivo:** `src/components/dashboard/BalanceProjectionChart.tsx`
**Arquivo:** `src/hooks/useDashboardData.ts` (ajustar tipo `ProjectionDays` para aceitar `365` ou `"year"`)

---

### Detalhes Tecnicos

**SummaryCards.tsx:**
- Adicionar segunda fileira de 4 `SummaryCard` abaixo da primeira
- Cards: Entrada Consolidada (icone CheckCircle, verde), Entrada Prevista (icone Clock, azul), Saida Consolidada (icone CheckCircle, vermelho), Saida Prevista (icone Clock, laranja)

**PeriodFilter.tsx:**
- Manter botoes Hoje, Semana, Mes, Ano
- Substituir o Popover "Personalizado" por: `ChevronLeft` | label clicavel "Mes/Ano" | `ChevronRight`
- Estado interno `customMonth` (Date) que navega mes a mes
- Ao clicar nas setas: seta o filtro como `custom` com inicio/fim do mes correspondente
- Ao clicar no label: abre Popover com Calendar em modo range

**BalanceProjectionChart.tsx:**
- Alterar tipo `ProjectionDays` para `number` (ou union `30 | 60 | 90 | 365`)
- Adicionar opcao `{ days: 365, label: "Ano todo" }` no array de opcoes
- No `useDashboardData`, o `getProjectionData` ja aceita qualquer numero de dias, entao basta adicionar o botao

