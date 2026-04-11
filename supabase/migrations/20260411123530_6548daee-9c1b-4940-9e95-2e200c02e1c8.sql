ALTER TABLE public.pricing_v2_configurations
ADD COLUMN days_per_week numeric NULL,
ADD COLUMN hours_per_day numeric NULL;