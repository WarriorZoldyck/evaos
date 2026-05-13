
-- ============================================================
-- 1. Helper function: returns active hub member role for owner
-- ============================================================
CREATE OR REPLACE FUNCTION public.hub_member_role(_member_uid uuid, _owner_uid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.workspace_members
  WHERE member_user_id = _member_uid
    AND owner_id = _owner_uid
    AND status = 'active'
  LIMIT 1
$$;

-- ============================================================
-- 2. Helper: can hub member write (editor/admin) for this owner?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_hub_member_writer(_member_uid uuid, _owner_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE member_user_id = _member_uid
      AND owner_id = _owner_uid
      AND status = 'active'
      AND role IN ('editor','admin')
  )
$$;

-- ============================================================
-- 3. Helper: can hub member SEE a specific resource?
--    If member has NO permissions registered → sees everything (backwards compatible).
--    If member has permissions → only sees the listed resource_ids.
-- ============================================================
CREATE OR REPLACE FUNCTION public.hub_member_can_see(
  _member_uid uuid, _owner_uid uuid, _resource_type text, _resource_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.workspace_member_permissions wmp
        JOIN public.workspace_members wm ON wm.id = wmp.workspace_member_id
        WHERE wm.member_user_id = _member_uid
          AND wm.owner_id = _owner_uid
          AND wm.status = 'active'
      ) THEN true  -- no scoping → full access (legacy behavior)
      WHEN _resource_id IS NULL THEN true  -- transactions w/o the resource set are visible
      ELSE EXISTS (
        SELECT 1 FROM public.workspace_member_permissions wmp
        JOIN public.workspace_members wm ON wm.id = wmp.workspace_member_id
        WHERE wm.member_user_id = _member_uid
          AND wm.owner_id = _owner_uid
          AND wm.status = 'active'
          AND wmp.resource_type = _resource_type
          AND wmp.resource_id = _resource_id
      )
    END
$$;

-- ============================================================
-- 4. Audit log of impersonation actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_audit_owner ON public.hub_audit_log(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_audit_actor ON public.hub_audit_log(actor_user_id, created_at DESC);
ALTER TABLE public.hub_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view their hub audit log"
ON public.hub_audit_log FOR SELECT TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Members view their own actions"
ON public.hub_audit_log FOR SELECT TO authenticated
USING (auth.uid() = actor_user_id);

CREATE POLICY "Authenticated can insert their own audit row"
ON public.hub_audit_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = actor_user_id);

-- ============================================================
-- 5. Hub invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hub_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor','admin')),
  workspace_id uuid,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hub_invitations_owner ON public.hub_invitations(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_invitations_email ON public.hub_invitations(email, status);
ALTER TABLE public.hub_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their invitations"
ON public.hub_invitations FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- ============================================================
-- 6. RE-CREATE policies with role enforcement + scoping
-- Pattern:
--   USING:  owner OR (active member AND can_see)
--   WRITE CHECK: owner OR (writer member AND can_see)
-- For each table that has a relevant resource_type, we plug it into hub_member_can_see.
-- For tables WITHOUT a per-resource scope (categories, suppliers, clients, goals,
-- pricing*, profiles, ai_pending_transactions, recurring_transactions),
-- we just enforce role (writer-only on insert/update/delete).
-- ============================================================

-- TRANSACTIONS: scope by company_id
DROP POLICY IF EXISTS "Users and hub members can manage transactions" ON public.transactions;
CREATE POLICY "Owner full access to transactions"
ON public.transactions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read transactions in scope"
ON public.transactions FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can insert transactions in scope"
ON public.transactions FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can update transactions in scope"
ON public.transactions FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can delete transactions in scope"
ON public.transactions FOR DELETE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));

-- COMPANIES: resource itself is the scoped object
DROP POLICY IF EXISTS "Users and hub members can manage companies" ON public.companies;
CREATE POLICY "Owner full access to companies"
ON public.companies FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read companies in scope"
ON public.companies FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', id));
CREATE POLICY "Hub writers can insert companies"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update companies in scope"
ON public.companies FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', id));
CREATE POLICY "Hub admins can delete companies in scope"
ON public.companies FOR DELETE TO authenticated
USING (hub_member_role(auth.uid(), user_id) = 'admin' AND hub_member_can_see(auth.uid(), user_id, 'company', id));

-- BANK ACCOUNTS
DROP POLICY IF EXISTS "Users and hub members can manage bank accounts" ON public.bank_accounts;
CREATE POLICY "Owner full access to bank_accounts"
ON public.bank_accounts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read bank_accounts in scope"
ON public.bank_accounts FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'bank_account', id));
CREATE POLICY "Hub writers can insert bank_accounts"
ON public.bank_accounts FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update bank_accounts in scope"
ON public.bank_accounts FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'bank_account', id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'bank_account', id));
CREATE POLICY "Hub admins can delete bank_accounts in scope"
ON public.bank_accounts FOR DELETE TO authenticated
USING (hub_member_role(auth.uid(), user_id) = 'admin' AND hub_member_can_see(auth.uid(), user_id, 'bank_account', id));

-- CREDIT CARDS
DROP POLICY IF EXISTS "Users and hub members can manage credit cards" ON public.credit_cards;
CREATE POLICY "Owner full access to credit_cards"
ON public.credit_cards FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read credit_cards in scope"
ON public.credit_cards FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'credit_card', id));
CREATE POLICY "Hub writers can insert credit_cards"
ON public.credit_cards FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update credit_cards in scope"
ON public.credit_cards FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'credit_card', id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'credit_card', id));
CREATE POLICY "Hub admins can delete credit_cards in scope"
ON public.credit_cards FOR DELETE TO authenticated
USING (hub_member_role(auth.uid(), user_id) = 'admin' AND hub_member_can_see(auth.uid(), user_id, 'credit_card', id));

-- CARD TERMINALS
DROP POLICY IF EXISTS "Users and hub members can manage card terminals" ON public.card_terminals;
CREATE POLICY "Owner full access to card_terminals"
ON public.card_terminals FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read card_terminals in scope"
ON public.card_terminals FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'card_terminal', id));
CREATE POLICY "Hub writers can insert card_terminals"
ON public.card_terminals FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update card_terminals in scope"
ON public.card_terminals FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'card_terminal', id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'card_terminal', id));
CREATE POLICY "Hub admins can delete card_terminals in scope"
ON public.card_terminals FOR DELETE TO authenticated
USING (hub_member_role(auth.uid(), user_id) = 'admin' AND hub_member_can_see(auth.uid(), user_id, 'card_terminal', id));

-- WALLETS
DROP POLICY IF EXISTS "Users and hub members can manage wallets" ON public.wallets;
CREATE POLICY "Owner full access to wallets"
ON public.wallets FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read wallets in scope"
ON public.wallets FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'wallet', id));
CREATE POLICY "Hub writers can insert wallets"
ON public.wallets FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update wallets in scope"
ON public.wallets FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'wallet', id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'wallet', id));
CREATE POLICY "Hub admins can delete wallets in scope"
ON public.wallets FOR DELETE TO authenticated
USING (hub_member_role(auth.uid(), user_id) = 'admin' AND hub_member_can_see(auth.uid(), user_id, 'wallet', id));

-- RECURRING TRANSACTIONS: scope by company_id
DROP POLICY IF EXISTS "Users and hub members can manage recurring transactions" ON public.recurring_transactions;
CREATE POLICY "Owner full access to recurring"
ON public.recurring_transactions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read recurring in scope"
ON public.recurring_transactions FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can insert recurring in scope"
ON public.recurring_transactions FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can update recurring in scope"
ON public.recurring_transactions FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));
CREATE POLICY "Hub writers can delete recurring in scope"
ON public.recurring_transactions FOR DELETE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id) AND hub_member_can_see(auth.uid(), user_id, 'company', company_id));

-- AI PENDING TRANSACTIONS: role-only (no per-resource scope)
DROP POLICY IF EXISTS "Users and hub members can manage ai pending transactions" ON public.ai_pending_transactions;
CREATE POLICY "Owner full access to ai_pending"
ON public.ai_pending_transactions FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub members can read ai_pending"
ON public.ai_pending_transactions FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), user_id));
CREATE POLICY "Hub writers can write ai_pending"
ON public.ai_pending_transactions FOR INSERT TO authenticated
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can update ai_pending"
ON public.ai_pending_transactions FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id))
WITH CHECK (is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "Hub writers can delete ai_pending"
ON public.ai_pending_transactions FOR DELETE TO authenticated
USING (is_hub_member_writer(auth.uid(), user_id));

-- CATEGORIES, CLIENTS, SUPPLIERS, GOALS, GOAL_MOVEMENTS, PRICING*, PROFILES
-- Role-enforced (no per-resource scope today)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'categories','clients','suppliers','goals','goal_movements',
    'pricing_configurations','pricing_procedures',
    'pricing_v2_configurations','pricing_v2_cost_items','pricing_v2_procedures'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users and hub members can manage %s" ON public.%I',
      replace(t,'_',' '), t);
    EXECUTE format('CREATE POLICY "Owner full access to %s" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t, t);
    EXECUTE format('CREATE POLICY "Hub members can read %s" ON public.%I FOR SELECT TO authenticated USING (is_hub_member(auth.uid(), user_id))', t, t);
    EXECUTE format('CREATE POLICY "Hub writers can insert %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (is_hub_member_writer(auth.uid(), user_id))', t, t);
    EXECUTE format('CREATE POLICY "Hub writers can update %s" ON public.%I FOR UPDATE TO authenticated USING (is_hub_member_writer(auth.uid(), user_id)) WITH CHECK (is_hub_member_writer(auth.uid(), user_id))', t, t);
    EXECUTE format('CREATE POLICY "Hub writers can delete %s" ON public.%I FOR DELETE TO authenticated USING (is_hub_member_writer(auth.uid(), user_id))', t, t);
  END LOOP;
END $$;

-- PROFILES uses id, not user_id
DROP POLICY IF EXISTS "Users and hub members can view and update profile" ON public.profiles;
CREATE POLICY "Owner full access to profile"
ON public.profiles FOR ALL TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Hub members can read owner profile"
ON public.profiles FOR SELECT TO authenticated
USING (is_hub_member(auth.uid(), id));
CREATE POLICY "Hub writers can update owner profile"
ON public.profiles FOR UPDATE TO authenticated
USING (is_hub_member_writer(auth.uid(), id))
WITH CHECK (is_hub_member_writer(auth.uid(), id));
