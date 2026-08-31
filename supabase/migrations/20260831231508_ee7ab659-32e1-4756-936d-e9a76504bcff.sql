ALTER TABLE public.pricing_v2_configurations
  ADD COLUMN IF NOT EXISTS productive_loss_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_weekdays jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_days jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.pricing_v2_configurations
  ADD CONSTRAINT pricing_v2_loss_pct_range CHECK (productive_loss_pct >= 0 AND productive_loss_pct < 100);