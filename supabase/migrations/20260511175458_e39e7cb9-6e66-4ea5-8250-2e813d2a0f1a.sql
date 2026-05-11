
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_price_cents integer;

UPDATE public.subscription_plans SET yearly_price_cents = 99900 WHERE slug = 'individual';
UPDATE public.subscription_plans SET yearly_price_cents = 139900 WHERE slug = 'familia';

UPDATE public.subscription_coupons
  SET discount_value = 229.00
  WHERE code = 'AMIGO30';
