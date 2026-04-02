
-- profiles
DROP POLICY IF EXISTS "Users can view and update their own profile." ON public.profiles;
CREATE POLICY "Users can view and update their own profile."
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- transactions
DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.transactions;
CREATE POLICY "Users can manage their own transactions."
  ON public.transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- recurring_transactions
DROP POLICY IF EXISTS "Users can manage their own recurring transactions." ON public.recurring_transactions;
CREATE POLICY "Users can manage their own recurring transactions."
  ON public.recurring_transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ai_pending_transactions
DROP POLICY IF EXISTS "Users can manage their own ai pending transactions" ON public.ai_pending_transactions;
CREATE POLICY "Users can manage their own ai pending transactions"
  ON public.ai_pending_transactions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- bank_accounts
DROP POLICY IF EXISTS "Users can manage their own bank accounts." ON public.bank_accounts;
CREATE POLICY "Users can manage their own bank accounts."
  ON public.bank_accounts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- credit_cards
DROP POLICY IF EXISTS "Users can manage their own credit cards." ON public.credit_cards;
CREATE POLICY "Users can manage their own credit cards."
  ON public.credit_cards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- wallets
DROP POLICY IF EXISTS "Users can manage their own wallets." ON public.wallets;
CREATE POLICY "Users can manage their own wallets."
  ON public.wallets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- categories (drop both duplicates)
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can manage their own categories." ON public.categories;
CREATE POLICY "Users can manage their own categories."
  ON public.categories FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- suppliers
DROP POLICY IF EXISTS "Users can manage their own suppliers." ON public.suppliers;
CREATE POLICY "Users can manage their own suppliers."
  ON public.suppliers FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- clients (drop duplicates)
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients."
  ON public.clients FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- companies
DROP POLICY IF EXISTS "Users can manage their own companies." ON public.companies;
CREATE POLICY "Users can manage their own companies."
  ON public.companies FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- card_terminals (drop duplicates)
DROP POLICY IF EXISTS "Users can manage their own card terminals." ON public.card_terminals;
DROP POLICY IF EXISTS "Users can manage their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can delete their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can insert their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can update their own terminals" ON public.card_terminals;
DROP POLICY IF EXISTS "Users can view their own terminals" ON public.card_terminals;
CREATE POLICY "Users can manage their own card terminals."
  ON public.card_terminals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- whatsapp_messages
DROP POLICY IF EXISTS "Users can manage their own whatsapp messages" ON public.whatsapp_messages;
CREATE POLICY "Users can manage their own whatsapp messages"
  ON public.whatsapp_messages FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- whatsapp_pending_actions
DROP POLICY IF EXISTS "Users can manage their own pending actions" ON public.whatsapp_pending_actions;
CREATE POLICY "Users can manage their own pending actions"
  ON public.whatsapp_pending_actions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_configurations
DROP POLICY IF EXISTS "Users can manage their own pricing" ON public.pricing_configurations;
DROP POLICY IF EXISTS "pricing_config_owner_policy" ON public.pricing_configurations;
CREATE POLICY "Users can manage their own pricing"
  ON public.pricing_configurations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_procedures
DROP POLICY IF EXISTS "pricing_proc_owner_policy" ON public.pricing_procedures;
CREATE POLICY "Users can manage their own pricing procedures"
  ON public.pricing_procedures FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_procedure_items
DROP POLICY IF EXISTS "pricing_items_owner_policy" ON public.pricing_procedure_items;
CREATE POLICY "Users can manage their own pricing procedure items"
  ON public.pricing_procedure_items FOR ALL
  TO authenticated
  USING (procedure_id IN (SELECT id FROM pricing_procedures WHERE user_id = auth.uid()))
  WITH CHECK (procedure_id IN (SELECT id FROM pricing_procedures WHERE user_id = auth.uid()));

-- pricing_v2_configurations
DROP POLICY IF EXISTS "Users can manage their own pricing v2 config" ON public.pricing_v2_configurations;
CREATE POLICY "Users can manage their own pricing v2 config"
  ON public.pricing_v2_configurations FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_v2_cost_items
DROP POLICY IF EXISTS "Users can manage their own pricing v2 cost items" ON public.pricing_v2_cost_items;
CREATE POLICY "Users can manage their own pricing v2 cost items"
  ON public.pricing_v2_cost_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_v2_procedures
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedures" ON public.pricing_v2_procedures;
CREATE POLICY "Users can manage their own pricing v2 procedures"
  ON public.pricing_v2_procedures FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- pricing_v2_procedure_items
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedure items" ON public.pricing_v2_procedure_items;
CREATE POLICY "Users can manage their own pricing v2 procedure items"
  ON public.pricing_v2_procedure_items FOR ALL
  TO authenticated
  USING (procedure_id IN (SELECT id FROM pricing_v2_procedures WHERE user_id = auth.uid()))
  WITH CHECK (procedure_id IN (SELECT id FROM pricing_v2_procedures WHERE user_id = auth.uid()));
