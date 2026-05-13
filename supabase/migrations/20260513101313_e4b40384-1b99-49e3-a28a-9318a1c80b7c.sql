
-- Expand RLS policies to allow active hub members to access the owner's data
-- Pattern: auth.uid() = user_id  →  (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))

-- transactions
DROP POLICY IF EXISTS "Users can manage their own transactions." ON public.transactions;
CREATE POLICY "Users and hub members can manage transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- recurring_transactions
DROP POLICY IF EXISTS "Users can manage their own recurring transactions." ON public.recurring_transactions;
CREATE POLICY "Users and hub members can manage recurring transactions"
  ON public.recurring_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- bank_accounts
DROP POLICY IF EXISTS "Users can manage their own bank accounts." ON public.bank_accounts;
CREATE POLICY "Users and hub members can manage bank accounts"
  ON public.bank_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- credit_cards
DROP POLICY IF EXISTS "Users can manage their own credit cards." ON public.credit_cards;
CREATE POLICY "Users and hub members can manage credit cards"
  ON public.credit_cards FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- card_terminals
DROP POLICY IF EXISTS "Users can manage their own card terminals." ON public.card_terminals;
CREATE POLICY "Users and hub members can manage card terminals"
  ON public.card_terminals FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- wallets
DROP POLICY IF EXISTS "Users can manage their own wallets." ON public.wallets;
CREATE POLICY "Users and hub members can manage wallets"
  ON public.wallets FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- categories
DROP POLICY IF EXISTS "Users can manage their own categories." ON public.categories;
CREATE POLICY "Users and hub members can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- companies
DROP POLICY IF EXISTS "Users can manage their own companies." ON public.companies;
CREATE POLICY "Users and hub members can manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- clients
DROP POLICY IF EXISTS "Users can manage their own clients." ON public.clients;
CREATE POLICY "Users and hub members can manage clients"
  ON public.clients FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- suppliers
DROP POLICY IF EXISTS "Users can manage their own suppliers." ON public.suppliers;
CREATE POLICY "Users and hub members can manage suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- goals
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users and hub members can manage goals"
  ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- goal_movements
DROP POLICY IF EXISTS "Users can manage their own goal movements" ON public.goal_movements;
CREATE POLICY "Users and hub members can manage goal movements"
  ON public.goal_movements FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_v2_configurations
DROP POLICY IF EXISTS "Users can manage their own pricing v2 config" ON public.pricing_v2_configurations;
CREATE POLICY "Users and hub members can manage pricing v2 config"
  ON public.pricing_v2_configurations FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_v2_cost_items
DROP POLICY IF EXISTS "Users can manage their own pricing v2 cost items" ON public.pricing_v2_cost_items;
CREATE POLICY "Users and hub members can manage pricing v2 cost items"
  ON public.pricing_v2_cost_items FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_v2_procedures
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedures" ON public.pricing_v2_procedures;
CREATE POLICY "Users and hub members can manage pricing v2 procedures"
  ON public.pricing_v2_procedures FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_v2_procedure_items (parent-derived: extend to include hub members of parent owner)
DROP POLICY IF EXISTS "Users can manage their own pricing v2 procedure items" ON public.pricing_v2_procedure_items;
CREATE POLICY "Users and hub members can manage pricing v2 procedure items"
  ON public.pricing_v2_procedure_items FOR ALL TO authenticated
  USING (
    procedure_id IN (
      SELECT id FROM public.pricing_v2_procedures
      WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
    )
  )
  WITH CHECK (
    procedure_id IN (
      SELECT id FROM public.pricing_v2_procedures
      WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
    )
  );

-- pricing_configurations
DROP POLICY IF EXISTS "Users can manage their own pricing" ON public.pricing_configurations;
CREATE POLICY "Users and hub members can manage pricing"
  ON public.pricing_configurations FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_procedures
DROP POLICY IF EXISTS "Users can manage their own pricing procedures" ON public.pricing_procedures;
CREATE POLICY "Users and hub members can manage pricing procedures"
  ON public.pricing_procedures FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- pricing_procedure_items (parent-derived)
DROP POLICY IF EXISTS "Users can manage their own pricing procedure items" ON public.pricing_procedure_items;
CREATE POLICY "Users and hub members can manage pricing procedure items"
  ON public.pricing_procedure_items FOR ALL TO authenticated
  USING (
    procedure_id IN (
      SELECT id FROM public.pricing_procedures
      WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
    )
  )
  WITH CHECK (
    procedure_id IN (
      SELECT id FROM public.pricing_procedures
      WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
    )
  );

-- ai_pending_transactions
DROP POLICY IF EXISTS "Users can manage their own ai pending transactions" ON public.ai_pending_transactions;
CREATE POLICY "Users and hub members can manage ai pending transactions"
  ON public.ai_pending_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));

-- profiles (uses id, not user_id)
DROP POLICY IF EXISTS "Users can view and update their own profile." ON public.profiles;
CREATE POLICY "Users and hub members can view and update profile"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id OR public.is_hub_member(auth.uid(), id))
  WITH CHECK (auth.uid() = id OR public.is_hub_member(auth.uid(), id));
