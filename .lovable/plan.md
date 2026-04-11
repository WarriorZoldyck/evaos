

## Plano: Multi-conta no Dashboard + Saldo atual + Extrato sem pendentes

### 3 entregas

---

### 1. Seletor multi-conta na sidebar (visão consolidada)

**Problema**: Hoje o seletor de contexto na sidebar permite apenas "Pessoal" OU uma empresa. O usuário quer selecionar múltiplas contas (Pessoal + Empresa X) e ver o dashboard consolidado.

**Solução**: Transformar o dropdown da sidebar em um menu com checkboxes:
- Opção "Todas as contas" no topo (atalho para selecionar tudo)
- Cada conta (Pessoal, Empresa A, Empresa B...) com checkbox
- Quando mais de uma está selecionada, o label mostra "Todas as contas" ou "2 contas selecionadas"
- O `CompanyContext` ganha um novo estado: `selectedCompanyIds: string[]` (array) + `viewAll: boolean`
- Os hooks de dados (`useDashboardData`, `useAccounts`, etc.) passam a aceitar o array e fazem queries com `.in("company_id", [...ids])` ou removem o filtro de company quando `viewAll = true`

**Arquivos afetados**:
- `src/contexts/CompanyContext.tsx` — adicionar `selectedCompanyIds`, `viewAll`, `setViewAll`
- `src/components/layout/AppSidebar.tsx` — trocar dropdown por menu com checkboxes
- `src/hooks/useDashboardData.ts` — adaptar queries para aceitar múltiplas companies
- `src/hooks/useAccounts.ts` — idem

**Nota**: As demais páginas (Lançamentos, DRE, etc.) continuam usando `selectedCompanyId` (single). A visão multi-conta é exclusiva do Dashboard por enquanto — o filtro de conta existente no Dashboard (`Select` de contas bancárias) continua funcionando normalmente como filtro adicional.

---

### 2. Card de saldo atual das contas no Dashboard

**Problema**: O Dashboard mostra receitas, despesas e saldo do período, mas NÃO mostra o saldo atual real das contas bancárias/carteiras.

**Solução**: Adicionar um card "Saldo Atual" na linha principal do Dashboard (SummaryCards), que mostra a soma dos saldos reais de todas as contas (banco + carteira) usando o `initial_balance + transações pagas`. Quando um filtro de conta específica está ativo, mostra apenas o saldo daquela conta.

**Arquivos afetados**:
- `src/hooks/useDashboardData.ts` — calcular saldo atual real (já tem `initialBalances`, basta adicionar soma das transações pagas)
- `src/components/dashboard/SummaryCards.tsx` — adicionar card "Saldo Atual" com ícone de carteira
- `src/pages/Dashboard.tsx` — passar o novo dado para SummaryCards

---

### 3. Extrato: ocultar transações pendentes

**Problema**: O extrato da conta mostra transações pendentes com badge "Pendente", mesmo que elas não afetem o saldo. Não faz sentido aparecerem no extrato.

**Solução**: Adicionar `.eq("status", "Pago")` na query do extrato (linha 62-73 do `AccountStatementModal.tsx`). Simples — uma linha.

**Arquivo afetado**:
- `src/components/contas/AccountStatementModal.tsx` — adicionar filtro `status = Pago` na query principal

---

### Detalhes técnicos

**CompanyContext — novo estado multi-select**:
```text
selectedCompanyIds: string[]    // IDs das empresas selecionadas
viewAll: boolean                // true = ignora filtro de company
setViewAll(v: boolean)          // toggle
toggleCompanyId(id: string)     // adiciona/remove do array
```

O `selectedCompanyId` (singular) continua existindo para as páginas que não suportam multi-conta. O Dashboard usa o `viewAll`/`selectedCompanyIds` quando disponível.

**Query multi-conta no Dashboard**:
Quando `viewAll = true`, remove os filtros `.is("company_id", null)` e `.eq("company_id", ...)`. Quando `selectedCompanyIds` tem itens, usa `.or(...)` com combinação de `company_id.is.null` (pessoal) e `company_id.in.(ids)`.

**Saldo atual**: Usa a função `get_account_balance` do banco (já existe como DB function) ou calcula client-side somando `initial_balance + Σ(receitas pagas) - Σ(despesas pagas)` de todas as contas visíveis.

**Nenhuma migração de banco necessária.**

