
CREATE TABLE public.itau_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  bank_account_id UUID,
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,
  client_secret_iv TEXT NOT NULL,
  certificate_encrypted TEXT,
  certificate_iv TEXT,
  agency TEXT,
  account_number TEXT,
  account_digit TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',
  last_error TEXT,
  initial_balance_synced NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.itau_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own itau integrations"
  ON public.itau_integrations
  FOR ALL
  USING (auth.uid() = user_id OR public.is_hub_member_writer(auth.uid(), user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member_writer(auth.uid(), user_id));

CREATE TRIGGER itau_integrations_touch_updated_at
  BEFORE UPDATE ON public.itau_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_itau_integrations_user ON public.itau_integrations(user_id);
CREATE INDEX idx_itau_integrations_bank_account ON public.itau_integrations(bank_account_id);
