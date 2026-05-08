
CREATE TABLE public.asaas_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  bank_account_id uuid NOT NULL,
  api_key_encrypted text NOT NULL,
  api_key_iv text NOT NULL,
  initial_balance_synced numeric,
  last_sync_at timestamptz,
  sync_status text NOT NULL DEFAULT 'idle',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_account_id)
);

ALTER TABLE public.asaas_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own asaas integrations"
ON public.asaas_integrations FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_asaas_integrations_updated
BEFORE UPDATE ON public.asaas_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.asaas_sync_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.asaas_integrations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  asaas_id text NOT NULL,
  source_type text NOT NULL,
  amount numeric NOT NULL,
  date date NOT NULL,
  description text,
  asaas_status text,
  match_status text NOT NULL DEFAULT 'pending',
  matched_transaction_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(integration_id, asaas_id, source_type)
);

CREATE INDEX idx_asaas_sync_items_user ON public.asaas_sync_items(user_id);
CREATE INDEX idx_asaas_sync_items_integration ON public.asaas_sync_items(integration_id);
CREATE INDEX idx_asaas_sync_items_status ON public.asaas_sync_items(match_status);
CREATE INDEX idx_asaas_sync_items_date ON public.asaas_sync_items(date);

ALTER TABLE public.asaas_sync_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own asaas sync items"
ON public.asaas_sync_items FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_asaas_sync_items_updated
BEFORE UPDATE ON public.asaas_sync_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
