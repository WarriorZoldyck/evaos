
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_accounts integer,
  ADD COLUMN IF NOT EXISTS max_hub_members integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_ai_messages integer,
  ADD COLUMN IF NOT EXISTS extra_user_price_cents integer NOT NULL DEFAULT 0;

UPDATE public.subscription_plans
  SET max_accounts = 3, max_hub_members = 0, monthly_ai_messages = 100, extra_user_price_cents = 0
  WHERE slug = 'individual';

UPDATE public.subscription_plans
  SET max_accounts = NULL, max_hub_members = 3, monthly_ai_messages = 500, extra_user_price_cents = 2990
  WHERE slug = 'familia';

CREATE TABLE IF NOT EXISTS public.ai_usage_counters (
  user_id uuid NOT NULL,
  period_year_month text NOT NULL,
  messages_used integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period_year_month)
);

ALTER TABLE public.ai_usage_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai usage"
  ON public.ai_usage_counters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_ai_usage(_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  period text := to_char(now(), 'YYYY-MM');
  new_count integer;
BEGIN
  INSERT INTO public.ai_usage_counters (user_id, period_year_month, messages_used)
  VALUES (_uid, period, 1)
  ON CONFLICT (user_id, period_year_month)
  DO UPDATE SET messages_used = public.ai_usage_counters.messages_used + 1, updated_at = now()
  RETURNING messages_used INTO new_count;
  RETURN new_count;
END;
$$;
