

## Filtro padrão de "Mês" na página de Lançamentos

### O que muda
Quando o usuário acessar a página de Lançamentos, os filtros de data virão preenchidos com o mês atual (dia 1 até o último dia do mês), ao invés de vazio ("Tudo"). O usuário pode alterar para qualquer outro período normalmente.

### Alterações

**Arquivo: `src/hooks/useTransactions.ts`**
- Alterar o estado inicial de `filters` para que `dateFrom` e `dateTo` venham preenchidos com o primeiro e último dia do mês atual (usando `startOfMonth` e `endOfMonth` + `format`).

**Arquivo: `src/components/lancamentos/TransactionFilters.tsx`**
- Alterar o estado inicial de `activePeriod` de `"all"` para `"month"`, para que o botão "Mês" apareça selecionado visualmente ao abrir a página.

### Comportamento preservado
- Se o usuário chegar via link do Dashboard com query params (dateFrom, dateTo, category, etc.), esses valores sobrescrevem o padrão do mês, mantendo o fluxo existente.
- Todos os outros filtros (busca, tipo, categoria, conta) continuam iguais.
