
CREATE TABLE public.subscription_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent','fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  applies_to_plan_slug text,
  applies_to_cycle text CHECK (applies_to_cycle IN ('monthly','yearly','both')) DEFAULT 'both',
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read active coupons"
ON public.subscription_coupons FOR SELECT TO authenticated
USING (is_active = true);

CREATE TABLE public.subscription_coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.subscription_coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subscription_id uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE public.subscription_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own redemptions"
ON public.subscription_coupon_redemptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer NOT NULL DEFAULT 0;

INSERT INTO public.subscription_coupons
  (code, description, discount_type, discount_value, applies_to_plan_slug, applies_to_cycle, max_uses)
VALUES
  ('AMIGO30', 'Cupom amigo — 30% off plano Família anual', 'percent', 30, 'familia', 'yearly', 1);
