

## Soft Delete na Exclusão de Conta

### Resumo
Substituir a exclusão permanente (hard delete) por soft delete, marcando registros com `deleted_at` em vez de removê-los. A conta do auth.users também será desabilitada (banida) em vez de excluída. Uma Edge Function de limpeza poderá ser chamada manualmente ou via cron para purgar dados com mais de 30 dias.

### 1. Migration: adicionar coluna `deleted_at` nas tabelas

Adicionar `deleted_at TIMESTAMPTZ DEFAULT NULL` nas seguintes tabelas:
- `profiles`, `transactions`, `recurring_transactions`, `bank_accounts`, `credit_cards`, `wallets`, `card_terminals`, `categories`, `clients`, `suppliers`, `companies`, `pricing_configurations`, `pricing_procedures`, `pricing_procedure_items`, `goals`, `goal_movements`, `pricing_v2_configurations`, `pricing_v2_procedures`, `pricing_v2_procedure_items`, `pricing_v2_cost_items`

Atualizar as RLS policies para filtrar `deleted_at IS NULL` no SELECT (dados soft-deleted ficam invisíveis para o usuário).

### 2. Edge Function `delete-account` -- Soft Delete

Alterar a lógica para:
- Em vez de `DELETE`, fazer `UPDATE SET deleted_at = NOW()` em todas as tabelas do usuário
- Em vez de `auth.admin.deleteUser()`, usar `auth.admin.updateUserById(userId, { ban_duration: '876000h' })` para banir o usuário (impede login, preserva o registro)
- Retornar sucesso para o frontend fazer signOut

### 3. Nova Edge Function `purge-deleted-accounts`

- Busca profiles onde `deleted_at < NOW() - INTERVAL '30 days'`
- Para cada um, executa hard delete em todas as tabelas + `auth.admin.deleteUser()`
- Pode ser chamada via cron externo ou manualmente

### 4. Frontend: Confirmação por email

No `Configuracoes.tsx`:
- Trocar o texto de confirmação de "EXCLUIR" para exigir que o usuário digite seu **email** completo
- Validar `confirmText === user.email` antes de habilitar o botão
- Atualizar os textos de instrução

### 5. Queries existentes

As queries nos hooks (`useTransactions`, `useAccounts`, etc.) já filtram por `user_id` via RLS. Ao adicionar `deleted_at IS NULL` nas RLS policies de SELECT, os dados soft-deleted ficam automaticamente invisíveis sem alterar código dos hooks.

### Arquivos afetados
- **Migration SQL**: nova migration com ALTER TABLE + UPDATE RLS policies
- `supabase/functions/delete-account/index.ts`: soft delete em vez de hard delete
- `supabase/functions/purge-deleted-accounts/index.ts`: nova função de limpeza
- `supabase/config.toml`: registrar nova function
- `src/pages/Configuracoes.tsx`: confirmação por email

