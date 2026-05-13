## Objetivo

Permitir que membros do EVA Hub leiam **e editem** os dados do owner quando estiverem em impersonação, expandindo as policies RLS para reconhecer o vínculo via `public.is_hub_member(auth.uid(), user_id)` (função SECURITY DEFINER já existente).

Escopo desta entrega: **apenas RLS** (destrava o bloqueador #1). Enforcement de roles (`viewer` não pode escrever) fica para uma próxima entrega.

## Tabelas afetadas

Todas usam o padrão atual `auth.uid() = user_id`. Vão ser substituídas por `auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id)`:

- `transactions`, `recurring_transactions`
- `bank_accounts`, `credit_cards`, `card_terminals`, `wallets`
- `categories`, `companies`, `clients`, `suppliers`
- `goals`, `goal_movements`
- `pricing_v2_configurations`, `pricing_v2_cost_items`, `pricing_v2_procedures`
- `pricing_configurations`, `pricing_procedures`
- `ai_pending_transactions`
- `profiles` (ajusta `auth.uid() = id` → permite ver perfil do owner se for membro)

Tabelas filhas via subquery (`pricing_v2_procedure_items`, `pricing_procedure_items`) herdam acesso pela policy do pai — sem mudança direta.

**Fora de escopo desta migração:**
- `whatsapp_messages`, `whatsapp_pending_actions`, `ai_usage_counters` — pessoais do owner, membro não precisa.
- `subscriptions`, `subscription_*`, `asaas_*` — administrativas, só owner.
- `workspaces`, `workspace_members`, `workspace_member_permissions` — já têm policies próprias.

## Padrão de policy

Para cada tabela, dropar a policy `ALL` existente e recriar duas:
- **SELECT/INSERT/UPDATE/DELETE** liberadas para `auth.uid() = user_id OR is_hub_member(auth.uid(), user_id)` em USING e WITH CHECK.

Mantém compatibilidade total com o owner (caso `auth.uid() = user_id` continua válido) e abre acesso para membros ativos.

## Observações de segurança

- `is_hub_member` já é `SECURITY DEFINER STABLE` e checa `status = 'active'` em `workspace_members` — suspender membro corta acesso imediato.
- WITH CHECK também usa o OR, então membro pode inserir registros marcados com `user_id = owner_id` (necessário para criar lançamentos durante impersonação). O frontend já preenche `user_id` com `effectiveUserId` via `CompanyContext` — mas hooks como `useAccounts` ainda usam `user.id` direto. **Isso vai precisar de ajuste em código depois** para que membros gravem dados sob o `user_id` do owner; nesta migração só desbloqueamos a possibilidade no banco.

## Próximos passos (não inclusos aqui)

1. Ajustar hooks que escrevem (`useAccounts`, `useTransactions`, `useCategories`, etc.) para usar `effectiveUserId` em vez de `user.id` no INSERT/UPDATE.
2. Enforcement de roles no banco (viewer só SELECT) e no frontend (esconder botões).
3. Persistir impersonação em localStorage para sobreviver a reload.

## Migração SQL (resumo)

Para cada tabela listada: `DROP POLICY ... ; CREATE POLICY ... USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id)) WITH CHECK (...)`. Para `profiles`, troca `auth.uid() = id` por `auth.uid() = id OR is_hub_member(auth.uid(), id)`.