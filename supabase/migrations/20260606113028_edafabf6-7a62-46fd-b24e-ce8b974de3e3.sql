
CREATE TABLE public.belvo_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  bank_account_id uuid,
  link_id text NOT NULL,
  institution text,
  institution_display_name text,
  environment text NOT NULL DEFAULT 'sandbox',
  last_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle',
  last_error text,
  initial_balance_synced numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, link_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.belvo_integrations TO authenticated;
GRANT ALL ON public.belvo_integrations TO service_role;

ALTER TABLE public.belvo_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access to belvo integrations"
  ON public.belvo_integrations FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hub writers can manage belvo integrations"
  ON public.belvo_integrations FOR ALL TO authenticated
  USING (public.is_hub_member_writer(auth.uid(), user_id))
  WITH CHECK (public.is_hub_member_writer(auth.uid(), user_id));

CREATE TRIGGER trg_belvo_integrations_touch
  BEFORE UPDATE ON public.belvo_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
