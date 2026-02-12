

## Correcoes e Melhorias no Dashboard + Categorias

### 1. Card "Entrada Prevista" = Previsto MENOS Consolidado

**Problema atual:** O card "Entrada Prevista" mostra o valor total previsto por competencia, mas deveria mostrar apenas o que FALTA receber (previsto - consolidado). Apos liquidar, o valor sai automaticamente da previsao.

**Solucao:**
- No `useDashboardData.ts`, calcular `entradaPrevista = previstoReceitas - consolidadoReceitas`
- Remover os cards **"Saida Prevista"** e **"Entrada Consolidada"** (redundantes, ja que Entradas/Saidas ja mostram o consolidado)
- Manter apenas 6 cards: Faturamento, Entradas, Saidas, Saldo, **Entrada Prevista** (o que falta receber), **Saida Prevista** removida

**Arquivos:** `SummaryCards.tsx`, `useDashboardData.ts`, `Dashboard.tsx`

---

### 2. Projecao "Ano todo" deve ir ate 31/12 do ano vigente

**Problema atual:** Usa `addDays(today, 365)`, que vai de Fev/2026 ate Fev/2027. Deveria ir ate 31/12/2026.

**Solucao:**
- Quando `days === 365`, calcular `endOfYear(today)` em vez de `addDays(today, 365)`
- Assim o grafico sempre projeta ate o final do ano corrente, incluindo Janeiro

**Arquivo:** `useDashboardData.ts` (funcao `getProjectionData`)

---

### 3. Graficos de Categoria clicaveis (link para Lancamentos)

**Problema atual:** Os graficos de rosca (Receita/Despesa por Categoria) sao apenas visuais, sem interacao.

**Solucao:**
- Ao clicar em uma fatia do grafico, navegar para `/lancamentos` com filtro de categoria aplicado via query params (ex: `/lancamentos?category=Servicos&type=receita`)
- A pagina de Lancamentos ja tem filtros; sera necessario ler os query params na montagem

**Arquivos:** `CategorySummaryCharts.tsx`, `Lancamentos.tsx` (ler query params)

---

### 4. Filtro por Conta no Dashboard e na Projecao

**Problema atual:** Nao existe filtro por conta bancaria no dashboard.

**Solucao:**
- Adicionar um Select de conta no header do Dashboard (ao lado do filtro de periodo)
- Passar o `accountId` selecionado para `useDashboardData`
- Filtrar todas as queries por `bank_account_id` quando selecionado
- Na projecao, tambem filtrar por conta

**Arquivos:** `Dashboard.tsx`, `PeriodFilter.tsx` (ou novo componente `AccountFilter`), `useDashboardData.ts`

---

### 5. Liquidacao de fatura de cartao inteira

**Problema atual:** No "Proximos Lancamentos", cada transacao de cartao aparece individual. O usuario quer agrupar por cartao e liquidar a fatura inteira de uma vez.

**Solucao:**
- No `UpcomingTransactions`, agrupar transacoes pendentes que compartilham o mesmo `credit_card_id` e mesmo mes de vencimento
- Exibir um card "Fatura Cartao X - Mar/2026 - R$ total" com botao "Liquidar Fatura"
- O `LiquidateModal` recebera uma lista de transacoes e liquidara todas de uma vez
- Considerar o `closing_day` e `due_day` do cartao para determinar qual mes de fatura

**Arquivos:** `UpcomingTransactions.tsx`, `LiquidateModal.tsx`, `useDashboardData.ts`

---

### 6. Fechamento de cartao em mes anterior

**Problema atual:** Quando o `closing_day` do cartao faz com que compras do mes anterior entrem na fatura atual, o sistema nao agrupa corretamente.

**Solucao:**
- Ao agrupar faturas, usar o `closing_day` da tabela `credit_cards` para determinar o ciclo da fatura
- Compras ate o dia de fechamento pertencem a fatura do mes corrente; apos o fechamento, pertencem ao proximo mes
- Buscar dados de `credit_cards` (closing_day, due_day) no `useDashboardData`

**Arquivos:** `useDashboardData.ts`, `UpcomingTransactions.tsx`

---

### 7. CategorySelectWithCreate: cascata corrigida

**Problema atual:** So funciona criar subcategoria se a categoria pai ja existir. Se o usuario quer criar categoria + subcategoria + sub-sub de uma vez, precisa criar nivel por nivel.

**Solucao:**
- Apos criar uma categoria no nivel 1, automaticamente atualizar a lista e seleciona-la, habilitando o nivel 2
- Apos criar subcategoria no nivel 2, atualizar e habilitar nivel 3
- O problema real e que o `onCategoryCreated` precisa fazer refetch E setar o valor no form para que os niveis abaixo desbloqueiem
- Revisar o fluxo no `TransactionFormModal` para garantir que ao criar uma categoria, ela e auto-selecionada e o proximo nivel fica habilitado imediatamente

**Arquivo:** `CategorySelectWithCreate.tsx`, `TransactionFormModal.tsx`

---

### Detalhes Tecnicos

**Ordem de implementacao:**

1. Corrigir calculo do card "Entrada Prevista" e remover cards redundantes (`SummaryCards.tsx`, `useDashboardData.ts`)
2. Corrigir projecao "Ano todo" para usar `endOfYear` (`useDashboardData.ts`)
3. Corrigir cascata de categorias (`CategorySelectWithCreate.tsx`, `TransactionFormModal.tsx`)
4. Adicionar filtro por conta (`Dashboard.tsx`, `useDashboardData.ts`)
5. Tornar graficos de categoria clicaveis (`CategorySummaryCharts.tsx`, `Lancamentos.tsx`)
6. Implementar agrupamento e liquidacao de fatura de cartao (`UpcomingTransactions.tsx`, `LiquidateModal.tsx`, `useDashboardData.ts`)

**Mudancas no SummaryCards:**
- De 8 cards para 6: Faturamento, Entradas, Saidas, Saldo, Entrada Prevista (previsto - consolidado), Saida Prevista removida
- Ou manter so 5 se usuario confirmar remocao total de "Saida Prevista"

**Mudanca na projecao:**
```
// Antes:
const futureEnd = addDays(today, days);

// Depois:
const futureEnd = days === 365 ? endOfYear(today) : addDays(today, days);
```

**Filtro por conta - novo campo em DashboardFilters:**
```
interface DashboardFilters {
  period: PeriodKey;
  customStart?: Date;
  customEnd?: Date;
  accountId?: string | null;  // novo
}
```

**Agrupamento de fatura:**
- Query credit_cards para obter closing_day/due_day
- Agrupar transacoes pendentes com credit_card_id por ciclo de fatura
- Exibir como item unico com total e botao de liquidacao em lote

