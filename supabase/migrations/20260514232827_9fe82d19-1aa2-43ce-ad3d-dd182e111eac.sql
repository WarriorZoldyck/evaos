
-- 1) Add provider column to existing sync items table (backwards compatible)
ALTER TABLE public.asaas_sync_items
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'asaas';

CREATE INDEX IF NOT EXISTS idx_asaas_sync_items_provider
  ON public.asaas_sync_items(provider);

-- 2) New pluggy_integrations table
CREATE TABLE IF NOT EXISTS public.pluggy_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  bank_account_id uuid NOT NULL,
  pluggy_item_id text NOT NULL,
  pluggy_account_id text NOT NULL,
  institution_name text,
  connector_id integer,
  initial_balance_synced numeric,
  last_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle',
  last_error text,
  item_status text,
  encrypted_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, pluggy_account_id)
);

CREATE INDEX IF NOT EXISTS idx_pluggy_integrations_user
  ON public.pluggy_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_integrations_bank_account
  ON public.pluggy_integrations(bank_account_id);

ALTER TABLE public.pluggy_integrations ENABLE ROW LEVEL SECURITY;

-- Owner full access
CREATE POLICY "Owner full access to pluggy_integrations"
ON public.pluggy_integrations
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Hub members: read
CREATE POLICY "Hub members can read pluggy_integrations"
ON public.pluggy_integrations
FOR SELECT TO authenticated
USING (public.is_hub_member(auth.uid(), user_id));

-- Hub writers: insert/update/delete
CREATE POLICY "Hub writers can insert pluggy_integrations"
ON public.pluggy_integrations
FOR INSERT TO authenticated
WITH CHECK (public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "Hub writers can update pluggy_integrations"
ON public.pluggy_integrations
FOR UPDATE TO authenticated
USING (public.is_hub_member_writer(auth.uid(), user_id))
WITH CHECK (public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "Hub writers can delete pluggy_integrations"
ON public.pluggy_integrations
FOR DELETE TO authenticated
USING (public.is_hub_member_writer(auth.uid(), user_id));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_pluggy_integrations_updated_at ON public.pluggy_integrations;
CREATE TRIGGER trg_pluggy_integrations_updated_at
BEFORE UPDATE ON public.pluggy_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
