## O que fazer

### 1) Cards "Entradas" e "Saídas" abrem modal de detalhe (igual Faturamento)

Hoje, ao clicar em **Entradas** e **Saídas** no dashboard, o app apenas navega para `/lancamentos` com filtros. Vamos abrir um modal de detalhe no próprio dashboard (mesmo padrão do modal de Faturamento), mantendo o botão "Ver em Lançamentos" para o drill-down completo.

**Novo componente:** `src/components/dashboard/EntradasSaidasDetailModal.tsx`
- Reaproveita visual/layout do `FaturamentoDetailModal` (header com ícone, resumo em cards, filtros de forma de pagamento e status, tabela paginada, export CSV, botão "Ver em Lançamentos").
- Prop `mode: "entradas" | "saidas"` controla:
  - Título ("Entradas pagas no período" / "Saídas pagas no período")
  - Ícone/gradiente (verde `TrendingUp` / vermelho `TrendingDown`)
  - Filtro base: `type = receita` ou `type = despesa`, sempre `status = "Pago"` (o que compõe o valor do card)
  - Fonte: `transactions` filtradas por `payment_date` (mesma base que soma o card no `useDashboardData`)
- Agrupamento por `series_id` como no modal atual (parcelas viram 1 linha).
- Sem seção de MDR quando `mode = "saidas"` (não se aplica).
- Comparativo vs período anterior (usa `prevEntradas` / `prevSaidas` já disponíveis).

**Editar:** `src/pages/Dashboard.tsx`
- Adicionar `entradasModalOpen` e `saidasModalOpen` no estado.
- Passar `onEntradasClick` e `onSaidasClick` para `SummaryCards`.
- Renderizar `<EntradasSaidasDetailModal ... />` para cada modo, passando `transactions`, `prevEntradas`/`prevSaidas`, `dateFrom`/`dateTo`, `categoryNameResolver`.

**Editar:** `src/components/dashboard/SummaryCards.tsx`
- Adicionar props opcionais `onEntradasClick` e `onSaidasClick`.
- Trocar `onClick` dos cards Entradas e Saídas para preferir esses handlers, mantendo o `go(...)` como fallback.

### 2) Saldo do dashboard casar com Contas e Cartões

Diagnóstico: o dashboard já calcula `saldoAtual = Σ initial_balance + Σ deltas Pagos` via RPC `get_accounts_paid_delta` (correto e à prova do limite de 1000 linhas do PostgREST). A tela **Contas** mostra apenas `initial_balance` estático em cada linha — por isso os totais não batem. A correção é fazer a página Contas exibir o **saldo atual real** por conta/carteira, para que a soma bata com o card "Saldo Atual" do dashboard.

**Novo hook:** `src/hooks/useAccountCurrentBalances.ts`
- Recebe `bankAccounts` e `wallets` do contexto atual.
- Para cada conta, chama a função SQL existente `public.get_account_prior_balance(account_id, 'bank'|'wallet', date)` com `date = amanhã` para trazer todo o histórico Pago, e soma com `initial_balance`.
- Retorna `Map<accountId, number>` + `loading`. Faz refetch quando o `effectiveUserId` ou a lista muda.
- Alternativa (se performance for melhor): uma única chamada RPC nova que retorna `[{account_id, type, current_balance}]`. Fica como refino se necessário; a função `get_account_prior_balance` já existe e resolve por enquanto.

**Editar:** `src/pages/Contas.tsx`
- Usar o hook novo e trocar a exibição de `a.initial_balance` (linha ~222) por `currentBalances.get(a.id) ?? a.initial_balance` na coluna de saldo da tabela de contas bancárias.
- Fazer o mesmo para as `VirtualWalletCard` (linha ~341): passar `balance={String(currentBalances.get(w.id) ?? w.initial_balance)}`.
- Adicionar um pequeno rótulo "Saldo inicial: R$ X" abaixo do valor (tooltip ou linha secundária) para deixar claro que o inicial permanece registrado — resolve o entendimento do usuário de que "saldo inicial vai alterando".
- Não mexer no fluxo de edição do `initial_balance` (continua sendo o campo cadastral).

**Cartões de crédito:** o "saldo" de cartão é a fatura aberta, não um saldo positivo somável ao caixa. O card "Saldo Atual" do dashboard já ignora cartões (só bank + wallet). Vamos manter esse comportamento e, na tela Contas, garantir que o texto sobre cartões deixe claro que é "fatura atual do ciclo" (o `DashboardCreditCardsRow` já usa `useCreditCardCycleTotals`, sem alteração aqui).

## Detalhes técnicos

- **Fonte de verdade do saldo**: `initial_balance + Σ (receita − despesa) Pagos` por conta. Já implementado server-side em `get_accounts_paid_delta` (dashboard) e `get_account_prior_balance` (extrato). A tela Contas passa a consumir esse cálculo por linha em vez do valor cadastral.
- **Modal Entradas/Saídas**: reaproveita `SaleLine`/agrupamento por `series_id` do `FaturamentoDetailModal`, mas com base em `payment_date` + `status = Pago` (dashboard totals) em vez de competência. Isso garante que o "Total" do modal bate exatamente com o valor do card.
- **Sem mudanças de schema.** Nenhuma migração necessária.
- **Sem mudanças em RLS**, `get_account_prior_balance` já é `SECURITY DEFINER` e escopa por `auth.uid()`.
