INSERT INTO public.subscription_coupons (code, discount_type, discount_value, applies_to_cycle, applies_to_plan_slug, max_uses, is_active, description) VALUES
  ('MARISTELA50', 'percent', 50, 'both', NULL, 1, true, '50% off uso único - Maristela'),
  ('DENISE50', 'percent', 50, 'both', NULL, 1, true, '50% off uso único - Denise')
ON CONFLICT (code) DO NOTHING;