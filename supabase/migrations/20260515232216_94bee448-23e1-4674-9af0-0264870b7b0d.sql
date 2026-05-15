INSERT INTO public.subscription_coupons (code, discount_type, discount_value, max_uses, applies_to_cycle, is_active)
VALUES ('ERIKA50', 'percent', 50, 1, 'both', true)
ON CONFLICT (code) DO NOTHING;