## Melhorias nos Lancamentos e Dashboard

### 1. Cards do Dashboard clicaveis (drill-down para Lancamentos)

Ao clicar em cada card do Dashboard, o usuario sera redirecionado para a pagina de Lancamentos com filtros pre-aplicados:


| Card             | Filtros aplicados                                   |
| ---------------- | --------------------------------------------------- |
| Faturamento      | type=receita, periodo do dashboard                  |
| Entradas         | type=receita, status=Pago, periodo do dashboard     |
| Saidas           | type=despesa, status=Pago, periodo do dashboard     |
| Saldo do Periodo | periodo do dashboard (sem filtro de tipo)           |
| Entrada Prevista | type=receita, status=Pendente, periodo do dashboard |
| Saida Prevista   | type=despesa, status=Pendente, periodo do dashboard |


O componente `SummaryCards` recebera as datas do periodo e um `onClick` prop. A navegacao sera via query params na URL (`/lancamentos?type=receita&status=Pago&dateFrom=2026-02-01&dateTo=2026-02-28`).

A pagina `Lancamentos.tsx` ja le query params parcialmente -- sera expandida para ler `status`, `dateFrom` e `dateTo` tambem.

### 2. Parcelas visiveis ao editar lancamento

Atualmente a secao de parcelamento/recorrencia so aparece para novos lancamentos (`!isEditing`). A correcao vai:

- Remover a condicao `!isEditing` do bloco de parcelas
- Manter os controles desabilitados quando editando uma transacao que ja faz parte de uma serie (para evitar re-parcelamento), mas permitir ativar parcelamento em transacoes avulsas sendo editadas

### 3. Filtro por Conta/Carteira nos Lancamentos

Adicionar um Select de conta bancaria/carteira na barra de filtros (`TransactionFilters.tsx`). O filtro sera aplicado no hook `useTransactions` via query params `bank_account_id` ou `wallet_id`.

Alteracoes:

- `**TransactionFilters**`: Novo Select com opcoes agrupadas (Contas Bancarias, Carteiras)
- `**useTransactions**`: Nova propriedade `accountId` no tipo `TransactionFilters`, aplicada na query
- `**Lancamentos.tsx**`: Passar listas de `bankAccounts` e `wallets` para o componente de filtros

### 4. Novos metodos de pagamento

Adicionar ao array `PAYMENT_METHODS` em `TransactionFormModal.tsx`:

- **Cheque**
- **Depósito**
- **Débito Automático**
- **Outro**

Tambem ajustar `PaymentMethodFields.tsx` para que "Cheque" e "Deposito" mostrem o select de conta bancaria (mesma logica de Boleto/Transferencia).

### 5. Verificacao do MDR (data de liquidacao)

Ja verificado no codigo: `TransactionDetailModal.tsx` linha 85 usa `competence_date` como base para `addBusinessDays`, o que esta correto. O calculo no `TransactionFormModal.tsx` linha 451 tambem usa `competence_date`. Ambos estao consistentes.

---

### Detalhes tecnicos

**Arquivos alterados:**

1. `**src/components/dashboard/SummaryCards.tsx**` -- Adicionar `onClick` em cada card, receber props de periodo e usar `useNavigate`
2. `**src/pages/Dashboard.tsx**` -- Passar datas do periodo para SummaryCards
3. `**src/pages/Lancamentos.tsx**` -- Expandir leitura de query params (status, dateFrom, dateTo), passar bankAccounts/wallets para filtros
4. `**src/hooks/useTransactions.ts**` -- Adicionar `accountId` ao tipo TransactionFilters e aplicar na query
5. `**src/components/lancamentos/TransactionFilters.tsx**` -- Novo Select de conta/carteira
6. `**src/components/lancamentos/TransactionFormModal.tsx**` -- Adicionar metodos de pagamento + remover `!isEditing` do bloco de parcelas
7. `**src/components/lancamentos/PaymentMethodFields.tsx**` -- Ajustar logica de visibilidade para novos metodos

**Nenhuma alteracao no banco de dados necessaria.**