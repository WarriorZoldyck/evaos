## Objetivo
Aproveitar a área vazia à esquerda da tela de Metas para expandir a sidebar com mais métricas úteis do contexto, incluindo médias e um breakdown completo por categoria.

## Mudanças

### 1. Layout (`src/pages/Metas.tsx`)
- Aumentar a largura da coluna da sidebar de `320px` para `380px` e adicionar um `gap` maior (de `gap-6` para `gap-8`) para desgrudar visualmente da coluna principal.
- Aumentar o `max-w-6xl` para `max-w-7xl` para acomodar a sidebar mais larga sem espremer os cofrinhos.

### 2. Novas métricas (`src/hooks/useMetasSidebarStats.ts`)
Adicionar ao hook:
- **`totalIncomeYear`**: soma de todas as receitas (`type = 'receita'`, `status = 'Pago'`) do ano no contexto.
- **`avgIncomeMonth`**: média mensal de entradas — `totalIncomeYear / (mês atual)`.
- **`avgSpentMonth`**: média mensal de saídas pagas — `spentYear / (mês atual)`.
- **`projectedYearOutByAverage`**: nova projeção baseada em média — `avgSpentMonth * 12` (substitui a projeção atual que somava só pendentes conhecidos, dando resultado mais realista para quem não lança tudo com antecedência).
- **`allCategories`**: lista completa (não só top 3) de categorias com totais gastos no ano, ordenada desc. Já é calculada no `catMap` — apenas expor toda a lista.

### 3. Sidebar (`src/components/metas/MetasSidebar.tsx`)
Reorganizar em seções visuais:

**Seção "Saldo & Entradas"**
- Saldo total (mantém)
- Total de entradas no ano (novo)
- Média de entradas / mês (novo)

**Seção "Saídas"**
- Gasto acumulado no ano (mantém)
- Média de saídas / mês (novo)
- Projeção de saídas do ano — agora baseada em média (label atualizado: "Projeção do ano (média)")

**Seção "Resultado"**
- Sobra estimada (mantém, mas usa a nova projeção por média)
- Card de alerta de plano de ação (mantém, se `hasDeficit`)

**Seção "Gastos por categoria"** (nova, colapsável/scrollável)
- Card contendo lista de TODAS as categorias com:
  - Nome
  - Valor gasto no ano
  - Barra de progresso mostrando % do total
- Ordenada do maior para o menor
- `max-h-[400px] overflow-y-auto` para não estourar a tela quando houver muitas categorias

### 4. Ajustes de cálculo
- `leftover` passa a usar `projectedYearOutByAverage` no lugar de `pendingOutRemaining` para refletir o mesmo racional da nova projeção — evita mostrar sobra otimista quando o usuário não lança pendências futuras.
- `topCategories` (usado no `ActionPlanDialog`) continua sendo os top 3 da lista completa.

## Fora de escopo
- Não mexer no `ActionPlanDialog`, `GoalFormModal`, edge function ou lógica de metas em si.
- Sem novos endpoints/tabelas — tudo derivado das transações já buscadas.
