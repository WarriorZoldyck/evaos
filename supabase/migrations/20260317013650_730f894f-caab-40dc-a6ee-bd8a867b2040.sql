
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.credit_cards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.card_terminals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_configurations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_procedures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_procedure_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.goal_movements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_v2_configurations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_v2_procedures ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_v2_procedure_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.pricing_v2_cost_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- profiles
DROP POLICY IF EXISTS "Users can view and update their own profile." ON public.profiles;
CREATE POLICY "Users can select own profile" ON public.profiles FOR SELECT USING (auth.uid() = id AND deleted_at IS NULL);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- bank_accounts
DROP POLICY IF EXISTS "Users can manage their own bank accounts." ON public.bank_accounts;
CREATE POLICY "bank_accounts_select" ON public.bank_accounts FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "bank_accounts_insert" ON public.bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bank_accounts_update" ON public.bank_accounts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bank_accounts_delete" ON public.bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- credit_cards
DROP POLICY IF EXISTS "Users can manage their own credit cards." ON public.credit_cards;
CREATE POLICY "credit_cards_select" ON public.credit_cards FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "credit_cards_insert" ON public.credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_cards_update" ON public.credit_cards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_cards_delete" ON public.credit_cards FOR DELETE USING (auth.uid() = user_id);

-- wallets
DROP POLICY IF EXISTS "Users can manage their own wallets." ON public.wallets;
CREATE POLICY "wallets_select" ON public.wallets FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "wallets_insert" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallets_update" ON public.wallets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wallets_delete" ON public.wallets FOR DELETE USING (auth.uid() = user_id);

-- transactions
DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.transactions;
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- recurring_transactions
DROP POLICY IF EXISTS "Users can manage their own recurring transactions." ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_select" ON public.recurring_transactions FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "recurring_transactions_insert" ON public.recurring_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_transactions_update" ON public.recurring_transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_transactions_delete" ON public.recurring_transactions FOR DELETE USING (auth.uid() = user_id);

-- card_terminals
DROP POLICY IF EXISTS "Users can manage their own card terminals." ON public.card_terminals;
DROP POLICY IF EXISTS "Users can manage their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can insert their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can view their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can update their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can delete their own terminals" ON public.card_terminals;
CREATE POLICY "card_terminals_select" ON public.card_terminals FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "card_terminals_insert" ON public.card_terminals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_terminals_update" ON public.card_terminals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "card_terminals_delete" ON public.card_terminals FOR DELETE USING (auth.uid() = user_id);

-- categories
DROP POLICY IF EXISTS "Users can manage their own categories." ON public.categories;
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_delete" ON public.categories FOR DELETE USING (auth.uid() = user_id);

-- clients
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- suppliers
DROP POLICY IF EXISTS "Users can manage their own suppliers." ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (auth.uid() = user_id);

-- companies
DROP POLICY IF EXISTS "Users can manage their own companies." ON public.companies;
CREATE POLICY "companies_select" ON public.companies FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "companies_insert" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_update" ON public.companies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "companies_delete" ON public.companies FOR DELETE USING (auth.uid() = user_id);

-- goals
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "goals_select" ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "goals_insert" ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- goal_movements
DROP POLICY IF EXISTS "Users can manage their own goal movements" ON public.goal_movements;
CREATE POLICY "goal_movements_select" ON public.goal_movements FOR SELECT TO authenticated USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "goal_movements_insert" ON public.goal_movements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_movements_update" ON public.goal_movements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goal_movements_delete" ON public.goal_movements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pricing_configurations
DROP POLICY IF EXISTS "pricing_config_owner_policy" ON public.pricing_configurations;
DROP POLICY IF EXISTS "Users can manage their own pricing" ON public.pricing_configurations;
CREATE POLICY "pricing_configurations_select" ON public.pricing_configurations FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "pricing_configurations_insert" ON public.pricing_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_configurations_update" ON public.pricing_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_configurations_delete" ON public.pricing_configurations FOR DELETE USING (auth.uid() = user_id);

-- pricing_procedures
DROP POLICY IF EXISTS "pricing_proc_owner_policy" ON public.pricing_procedures;
CREATE POLICY "pricing_procedures_select" ON public.pricing_procedures FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "pricing_procedures_insert" ON public.pricing_procedures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_procedures_update" ON public.pricing_procedures FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_procedures_delete" ON public.pricing_procedures FOR DELETE USING (auth.uid() = user_id);

-- pricing_procedure_items
DROP POLICY IF EXISTS "pricing_items_owner_policy" ON public.pricing_procedure_items;
CREATE POLICY "pricing_procedure_items_select" ON public.pricing_procedure_items FOR SELECT USING (procedure_id IN (SELECT id FROM public.pricing_procedures WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "pricing_procedure_items_insert" ON public.pricing_procedure_items FOR INSERT WITH CHECK (procedure_id IN (SELECT id FROM public.pricing_procedures WHERE user_id = auth.uid()));
CREATE POLICY "pricing_procedure_items_update" ON public.pricing_procedure_items FOR UPDATE USING (procedure_id IN (SELECT id FROM public.pricing_procedures WHERE user_id = auth.uid()));
CREATE POLICY "pricing_procedure_items_delete" ON public.pricing_procedure_items FOR DELETE USING (procedure_id IN (SELECT id FROM public.pricing_procedures WHERE user_id = auth.uid()));

-- pricing_v2_configurations
DROP POLICY IF EXISTS "Users can manage their own pricing v2 config" ON public.pricing_v2_configurations;
CREATE POLICY "pricing_v2_configurations_select" ON public.pricing_v2_configurations FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "pricing_v2_configurations_insert" ON public.pricing_v2_configurations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_configurations_update" ON public.pricing_v2_configurations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_configurations_delete" ON public.pricing_v2_configurations FOR DELETE USING (auth.uid() = user_id);

-- pricing_v2_procedures
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedures" ON public.pricing_v2_procedures;
CREATE POLICY "pricing_v2_procedures_select" ON public.pricing_v2_procedures FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "pricing_v2_procedures_insert" ON public.pricing_v2_procedures FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_procedures_update" ON public.pricing_v2_procedures FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_procedures_delete" ON public.pricing_v2_procedures FOR DELETE USING (auth.uid() = user_id);

-- pricing_v2_procedure_items
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedure items" ON public.pricing_v2_procedure_items;
CREATE POLICY "pricing_v2_procedure_items_select" ON public.pricing_v2_procedure_items FOR SELECT USING (procedure_id IN (SELECT id FROM public.pricing_v2_procedures WHERE user_id = auth.uid() AND deleted_at IS NULL));
CREATE POLICY "pricing_v2_procedure_items_insert" ON public.pricing_v2_procedure_items FOR INSERT WITH CHECK (procedure_id IN (SELECT id FROM public.pricing_v2_procedures WHERE user_id = auth.uid()));
CREATE POLICY "pricing_v2_procedure_items_update" ON public.pricing_v2_procedure_items FOR UPDATE USING (procedure_id IN (SELECT id FROM public.pricing_v2_procedures WHERE user_id = auth.uid()));
CREATE POLICY "pricing_v2_procedure_items_delete" ON public.pricing_v2_procedure_items FOR DELETE USING (procedure_id IN (SELECT id FROM public.pricing_v2_procedures WHERE user_id = auth.uid()));

-- pricing_v2_cost_items
DROP POLICY IF EXISTS "Users can manage their own pricing v2 cost items" ON public.pricing_v2_cost_items;
CREATE POLICY "pricing_v2_cost_items_select" ON public.pricing_v2_cost_items FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "pricing_v2_cost_items_insert" ON public.pricing_v2_cost_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_cost_items_update" ON public.pricing_v2_cost_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pricing_v2_cost_items_delete" ON public.pricing_v2_cost_items FOR DELETE USING (auth.uid() = user_id);

-- whatsapp_pending_actions
DROP POLICY IF EXISTS "Users can manage their own pending actions" ON public.whatsapp_pending_actions;
CREATE POLICY "whatsapp_pending_actions_select" ON public.whatsapp_pending_actions FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "whatsapp_pending_actions_insert" ON public.whatsapp_pending_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "whatsapp_pending_actions_update" ON public.whatsapp_pending_actions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "whatsapp_pending_actions_delete" ON public.whatsapp_pending_actions FOR DELETE USING (auth.uid() = user_id);

-- Update get_account_balance to exclude soft-deleted transactions
CREATE OR REPLACE FUNCTION public.get_account_balance(account_id_param uuid)
 RETURNS numeric
 LANGUAGE plpgsql
AS $function$
DECLARE
    total_balance numeric;
BEGIN
    SELECT
        a.initial_balance + COALESCE(SUM(
            CASE
                WHEN t.type = 'receita' THEN t.amount
                ELSE -t.amount
            END
        ), 0)
    INTO total_balance
    FROM public.bank_accounts a
    LEFT JOIN public.transactions t ON a.id = t.bank_account_id AND t.status = 'Pago' AND t.deleted_at IS NULL
    WHERE a.id = account_id_param AND a.deleted_at IS NULL
    GROUP BY a.initial_balance;

    RETURN total_balance;
END;
$function$;
