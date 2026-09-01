ALTER TABLE public.pricing_v2_configurations
  ADD COLUMN IF NOT EXISTS weekday_schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS day_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reference_month text,
  ADD COLUMN IF NOT EXISTS observe_holidays boolean NOT NULL DEFAULT true;