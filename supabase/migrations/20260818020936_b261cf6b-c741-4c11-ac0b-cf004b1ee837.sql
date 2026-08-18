-- 1) Drop one-off backup tables containing copies of user financial data
DROP TABLE IF EXISTS public.backup_categorias_contexto_20260807;
DROP TABLE IF EXISTS public.backup_categories_integrity_20260808;
DROP TABLE IF EXISTS public.backup_renato_ctx_20260818;
DROP TABLE IF EXISTS public.backup_simoespaula_categorias_20260801;

-- 2) Company-level scoping helper for hub members
CREATE OR REPLACE FUNCTION public.hub_member_can_see_company(_member_uid uuid, _owner_uid uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    -- personal (no company) records stay visible to active members
    WHEN _company_id IS NULL THEN true
    -- member without any company-level restriction keeps full access
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.workspace_member_permissions wmp
      JOIN public.workspace_members wm ON wm.id = wmp.workspace_member_id
      WHERE wm.member_user_id = _member_uid
        AND wm.owner_id = _owner_uid
        AND wm.status = 'active'
        AND wmp.resource_type = 'company'
    ) THEN true
    ELSE public.hub_member_can_see(_member_uid, _owner_uid, 'company', _company_id)
  END
$$;

-- 3) categories
DROP POLICY IF EXISTS "Hub members can read categories" ON public.categories;
CREATE POLICY "Hub members can read categories" ON public.categories FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update categories" ON public.categories;
CREATE POLICY "Hub writers can update categories" ON public.categories FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete categories" ON public.categories;
CREATE POLICY "Hub writers can delete categories" ON public.categories FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 4) suppliers
DROP POLICY IF EXISTS "Hub members can read suppliers" ON public.suppliers;
CREATE POLICY "Hub members can read suppliers" ON public.suppliers FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update suppliers" ON public.suppliers;
CREATE POLICY "Hub writers can update suppliers" ON public.suppliers FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete suppliers" ON public.suppliers;
CREATE POLICY "Hub writers can delete suppliers" ON public.suppliers FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 5) clients
DROP POLICY IF EXISTS "Hub members can read clients" ON public.clients;
CREATE POLICY "Hub members can read clients" ON public.clients FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update clients" ON public.clients;
CREATE POLICY "Hub writers can update clients" ON public.clients FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete clients" ON public.clients;
CREATE POLICY "Hub writers can delete clients" ON public.clients FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 6) goals
DROP POLICY IF EXISTS "Hub members can read goals" ON public.goals;
CREATE POLICY "Hub members can read goals" ON public.goals FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update goals" ON public.goals;
CREATE POLICY "Hub writers can update goals" ON public.goals FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete goals" ON public.goals;
CREATE POLICY "Hub writers can delete goals" ON public.goals FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 7) goal_movements (scoped through parent goal)
DROP POLICY IF EXISTS "Hub members can read goal_movements" ON public.goal_movements;
CREATE POLICY "Hub members can read goal_movements" ON public.goal_movements FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND EXISTS (
  SELECT 1 FROM public.goals g WHERE g.id = goal_movements.goal_id
    AND hub_member_can_see_company(auth.uid(), goal_movements.user_id, g.company_id)
));

-- 8) budget_targets
DROP POLICY IF EXISTS "Hub members can view owner budget targets" ON public.budget_targets;
CREATE POLICY "Hub members can view owner budget targets" ON public.budget_targets FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update owner budget targets" ON public.budget_targets;
CREATE POLICY "Hub writers can update owner budget targets" ON public.budget_targets FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete owner budget targets" ON public.budget_targets;
CREATE POLICY "Hub writers can delete owner budget targets" ON public.budget_targets FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 9) ai_pending_transactions
DROP POLICY IF EXISTS "Hub members can read ai_pending" ON public.ai_pending_transactions;
CREATE POLICY "Hub members can read ai_pending" ON public.ai_pending_transactions FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can update ai_pending" ON public.ai_pending_transactions;
CREATE POLICY "Hub writers can update ai_pending" ON public.ai_pending_transactions FOR UPDATE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub writers can delete ai_pending" ON public.ai_pending_transactions;
CREATE POLICY "Hub writers can delete ai_pending" ON public.ai_pending_transactions FOR DELETE
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));

-- 10) pricing_v2 tables
DROP POLICY IF EXISTS "Hub members can read pricing_v2_configurations" ON public.pricing_v2_configurations;
CREATE POLICY "Hub members can read pricing_v2_configurations" ON public.pricing_v2_configurations FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub members can read pricing_v2_cost_items" ON public.pricing_v2_cost_items;
CREATE POLICY "Hub members can read pricing_v2_cost_items" ON public.pricing_v2_cost_items FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));
DROP POLICY IF EXISTS "Hub members can read pricing_v2_procedures" ON public.pricing_v2_procedures;
CREATE POLICY "Hub members can read pricing_v2_procedures" ON public.pricing_v2_procedures FOR SELECT
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see_company(auth.uid(), user_id, company_id));