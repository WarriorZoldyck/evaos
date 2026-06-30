## Objetivo

1. Destacar visualmente a **decomposição MDR** (bruto → taxa → líquido) ao abrir o detalhe de um lançamento de maquininha.
2. Adicionar **card "MDR pago no mês"** no Dashboard, com modal de drilldown mostrando histórico mensal + quebra por terminal/bandeira.

Sem mudanças de schema. Tudo calculado em memória a partir de `transactions` + `card_terminals` (mesma fórmula já usada no `TransactionDetailModal`).

---

## 1) Destaque do MDR no detalhe do lançamento

Arquivo: `src/components/lancamentos/TransactionDetailModal.tsx`

- Reposicionar o bloco "Detalhes MDR" para **logo abaixo do cabeçalho** (acima de Forma de Pagamento), para virar a primeira coisa que o usuário vê quando o lançamento é de maquininha.
- Trocar o container atual por um painel destacado com:
  - Borda âmbar/cyan + ícone de maquininha.
  - Grid 3 colunas: **Bruto** (valor da venda) | **Taxa MDR** (em vermelho, com %) | **Líquido** (em verde, fonte maior).
  - Linha inferior com badge "Recebimento D+X — dd/mm/aaaa".
  - Tooltip explicando o cálculo (`bruto × taxa = MDR`) e a origem da taxa (débito / crédito à vista / parcelado N×).
- Manter o cálculo atual intacto (mesma função, só re-renderizado).

## 2) Card "MDR pago no mês" no Dashboard

Arquivo: `src/components/dashboard/SummaryCards.tsx` (ou irmão) + novo hook `src/hooks/useMdrSummary.ts`.

- Hook `useMdrSummary(period)`:
  - Carrega transações de receita com `card_terminal_id` no período + terminais.
  - Calcula MDR por linha usando a mesma lógica do modal (débito / crédito à vista / parcelado via `rates_info`).
  - Retorna: `totalMdrMes`, `totalBrutoMes`, `taxaMediaPct`, `serieMensal[]` (últimos 12 meses), `porTerminal[]`, `porBandeira[]` (quando disponível em `payment_method`/`rates_info`).
- Novo card no Dashboard (mesma grade dos demais SummaryCards):
  - Título: "MDR pago no mês"
  - Valor principal: `R$ X` em vermelho
  - Subtítulo: `Y% sobre R$ Z bruto · N vendas`
  - Card clicável → abre `MdrDetailModal`.

## 3) Modal de drilldown MDR

Novo arquivo: `src/components/dashboard/MdrDetailModal.tsx`

Conteúdo:
- **KPIs no topo**: MDR do mês, MDR YTD, taxa média efetiva, ticket médio líquido.
- **Gráfico de barras** (Recharts) — últimos 12 meses, barras de MDR mensal + linha de taxa efetiva %.
- **Tabela por terminal** (mês selecionado): terminal · acquirer · bruto · MDR · taxa efetiva · nº vendas · líquido.
- **Tabela por modalidade**: Débito, Crédito à vista, Parcelado 2x, 3x… (agrupado pelo que existe em `installments_total` + `rates_info`).
- Seletor de mês no topo (default = mês corrente do contexto).
- Botão "Ver lançamentos" que leva para `/lancamentos` filtrado por terminal + mês.

## Considerações técnicas

- 100% client-side, reaproveita queries que o Dashboard já faz; sem nova migration.
- Respeita o `HubContext`/`ContextSelector` global (pessoal vs empresa) — usa as mesmas listas que `useTransactions`/`useAccounts` já filtram.
- Performance: memorizar cálculos por `(transactionId, terminalId)` no hook.
- Acessibilidade: card do Dashboard é `<button>` com `aria-label`; modal usa o `Dialog` padrão do shadcn.
- Sem mudanças em edge functions, RLS ou Supabase.

## Fora de escopo (deixar explícito)

- Não persistir MDR como lançamento filho.
- Não alterar conciliação bancária / fluxo de liquidação D+X (já existente).
- Não tocar em DRE — MDR continua implícito na receita líquida; se quiser categorizar como despesa real, é outra rodada.