

# Unificar seletor de contexto no menu lateral

## Objetivo
Remover o seletor secundário "Dashboard: ..." do menu lateral (redundante) e transformar o **seletor de contexto principal** em um seletor que aceita múltipla seleção via checkboxes. A multi-seleção afeta apenas as **páginas analíticas** (Dashboard, Plano de Caixa, DRE). Demais páginas continuam operando com um único contexto.

## Mudanças

### 1. `AppSidebar.tsx` — Unificar em um único dropdown
- Remover completamente o bloco "Dashboard multi-select" (linhas 157–190).
- Substituir o seletor principal (linhas 120–155) por um dropdown único com:
  - Item **"Todas as contas"** (atalho que ativa `viewAll = true`).
  - Separador.
  - Item **"Pessoal"** com Checkbox.
  - Um item por empresa, cada um com Checkbox.
- Label do botão exibe:
  - `"Todas as contas"` quando `viewAll`.
  - Nome único quando exatamente 1 selecionado (ex: `"Pessoal"` ou `"Acme LTDA"`).
  - `"N contextos"` quando múltiplos selecionados.
- Ícone: `User` se só Pessoal, `Building2` se empresa única, `Layers` se múltiplos/todos.

### 2. `CompanyContext.tsx` — Sincronização single↔multi
Manter o contrato existente para não quebrar consumidores, mas garantir consistência:
- Quando o usuário marca **exatamente 1** contexto no dropdown, atualizar também `selectedCompanyId` (e `isPersonal`) com aquele valor → páginas single-context (Lançamentos, Categorias, Metas, Contas, etc.) refletem automaticamente a escolha.
- Quando o usuário marca **2+** contextos, manter o `selectedCompanyId` no último valor escolhido (para fallback) — páginas single-context simplesmente ignoram o multi-select.
- `viewAll = true` reseta para Pessoal como single ativo.
- Adicionar handler `setSingleContext(id|null)` interno chamado quando count === 1 para sincronizar.

### 3. Hooks que consomem o contexto — Sem alterações
- `useDashboardData.ts`, `useCashFlowData.ts`, `useDREData.ts` → já recebem o multi-state correto.
  - `useDashboardData` já lê `viewAll/selectedCompanyIds/personalSelected` ✓
  - `useCashFlowData` e `useDREData` hoje só leem single → **passam a ler também** `viewAll/selectedCompanyIds/personalSelected` e aplicam o mesmo `applyCompanyFilter` do dashboard.
- Demais hooks (`useTransactions`, `useRecurringTransactions`, `useAccounts`, `useCategories`, `useGoals`, `usePricing`, etc.) → continuam usando apenas `selectedCompanyId/isPersonal`. Comportamento intacto.

### 4. Refatorar `applyCompanyFilter` para reuso
Mover a função de `useDashboardData.ts` para um util compartilhado `src/lib/companyFilter.ts` e importar nos 3 hooks analíticos (Dashboard, CashFlow, DRE).

## Resultado para o usuário
- **Um único seletor** no menu lateral, mais limpo.
- Marcar 1 contexto = comportamento idêntico ao atual (filtra todas as páginas).
- Marcar 2+ contextos = Dashboard / Plano de Caixa / DRE consolidam os contextos selecionados; outras páginas continuam usando o último contexto único marcado.
- "Todas as contas" continua disponível como atalho rápido.

## Arquivos afetados
- `src/components/layout/AppSidebar.tsx` (refatora seletor, remove o segundo bloco)
- `src/contexts/CompanyContext.tsx` (sincroniza single↔multi)
- `src/lib/companyFilter.ts` (novo — helper compartilhado)
- `src/hooks/useDashboardData.ts` (importa helper)
- `src/hooks/useCashFlowData.ts` (passa a aplicar multi-filter)
- `src/hooks/useDREData.ts` (passa a aplicar multi-filter)

