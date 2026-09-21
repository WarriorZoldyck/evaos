INSERT INTO public.subscription_coupons (
  id,
  code,
  description,
  discount_type,
  discount_value,
  applies_to_plan_slug,
  applies_to_cycle,
  max_uses,
  used_count,
  expires_at,
  is_active
)
VALUES (
  gen_random_uuid(),
  'ANDRE30',
  'Cupom de evento — 30% de desconto somente para assinatura anual',
  'percent',
  30,
  NULL,
  'yearly',
  NULL,
  0,
  NULL,
  true
)
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  applies_to_plan_slug = EXCLUDED.applies_to_plan_slug,
  applies_to_cycle = EXCLUDED.applies_to_cycle,
  max_uses = EXCLUDED.max_uses,
  expires_at = EXCLUDED.expires_at,
  is_active = EXCLUDED.is_active;