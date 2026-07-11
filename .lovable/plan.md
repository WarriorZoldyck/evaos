## O que fazer

### 1) Garantir que "Saldo Atual" do dashboard = soma dos saldos das contas

Hoje o card já usa `get_accounts_paid_delta` (Σ initial_balance + Σ deltas Pagos de bank + wallet). A tela Contas passou a usar `get_account_prior_balance` por conta. Vamos alinhar as duas fontes para que a soma bata 1:1:

- Em `useDashboardData.ts`, manter a lógica atual, mas garantir que `bank_ids` e `wallet_ids` passados ao RPC sejam exatamente os mesmos IDs listados em `useAccounts()` no contexto ativo (mesma filtragem por `company_id`/contexto).
- Não incluir cartões de crédito no `Saldo Atual` (fatura não é caixa) — comportamento atual mantido.
- Sanidade: se o usuário estiver no contexto Pessoal, somar só contas/carteiras Pessoais; mesmo critério que a página Contas usa.

### 2) Card "Saldo Atual" clicável → modal com contas e saldos

**Novo componente:** `src/components/dashboard/SaldoAtualDetailModal.tsx`
- Header: ícone `Wallet`, título "Saldo Atual por conta", subtítulo com o contexto ativo (Pessoal / Empresa X).
- Duas seções colapsáveis:
  - **Contas Bancárias** — lista `bankAccounts` do contexto com nome do banco, agência/número (se houver) e **Saldo Atual** (via `useAccountCurrentBalances(bankAccounts, 'bank')`).
  - **Carteiras** — lista `wallets` com nome e **Saldo Atual** (via `useAccountCurrentBalances(wallets, 'wallet')`).
- Rodapé: linha "Total" = soma de todos os saldos exibidos. Deve bater com o valor do card.
- Cada linha é clicável (hover destacado) e navega para `/lancamentos` com filtro pré-aplicado da conta clicada:
  - Bank → `?bank_account_id=<id>`
  - Wallet → `?wallet_id=<id>`
  - Já existe suporte a esses querystrings em `Lancamentos.tsx`/`TransactionFilters.tsx` (verificar; se faltar, adicionar leitura desses params e aplicar ao filtro inicial).
- Botão secundário "Abrir extrato" por linha (opcional) que abre o `AccountStatementModal` existente — mantém a UX consistente com a página Contas.

**Editar:** `src/components/dashboard/SummaryCards.tsx`
- Adicionar prop `onSaldoClick?: () => void`.
- No card "Saldo Atual", preferir `onSaldoClick` ao invés do `go(...)` atual, mantendo fallback.

**Editar:** `src/pages/Dashboard.tsx`
- Novo estado `saldoModalOpen`.
- Passar `onSaldoClick={() => setSaldoModalOpen(true)}` para `SummaryCards`.
- Renderizar `<SaldoAtualDetailModal open={saldoModalOpen} onClose={...} bankAccounts={...} wallets={...} />`.

### 3) Filtro por conta em Lançamentos (verificação)

- Conferir se `Lancamentos.tsx` lê `bank_account_id` e `wallet_id` dos search params e aplica no `TransactionFilters`. Se não ler, adicionar leitura no mount e setar o filtro inicial. Sem mudanças de schema.

## Detalhes técnicos

- **Fonte única de verdade**: `initial_balance + Σ (receita − despesa) Pagos`. Dashboard usa `get_accounts_paid_delta` (agregado); modal usa `get_account_prior_balance` (por conta). A soma no modal deve bater com o card — se houver divergência, é sinal de que os IDs do contexto diferem entre dashboard e página Contas; nesse caso, unificar a fonte de IDs (`useAccounts()` do contexto).
- **Sem mudanças de schema, RLS ou migrações.**
- **Sem alteração em cartões de crédito** — continuam fora do Saldo Atual.
- **Reaproveita**: `useAccountCurrentBalances` (já criado), `AccountStatementModal` (opcional para "Abrir extrato").
