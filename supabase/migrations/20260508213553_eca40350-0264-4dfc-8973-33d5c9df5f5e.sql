
-- Catálogo de planos
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  max_users integer NOT NULL DEFAULT 1 CHECK (max_users >= 1),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are public readable" ON public.subscription_plans FOR SELECT USING (true);

INSERT INTO public.subscription_plans (slug, name, description, price_cents, max_users, sort_order, features) VALUES
  ('individual', 'Individual', 'Para 1 usuário', 9990, 1, 1, '["Lançamentos ilimitados","Dashboard completo","EVA WhatsApp","Precificação","DRE","Suporte"]'::jsonb),
  ('familia', 'Família', 'Para até 3 usuários', 13990, 3, 2, '["Tudo do Individual","Até 3 usuários","Hub de gestão","Relatórios consolidados"]'::jsonb);

-- Vincula usuário ao customer Asaas
CREATE TABLE public.asaas_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_customer_id text NOT NULL UNIQUE,
  cpf_cnpj text NOT NULL,
  email text,
  name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own asaas customer" ON public.asaas_customers FOR SELECT USING (auth.uid() = user_id);

-- Assinaturas
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  asaas_subscription_id text UNIQUE,
  status text NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing','active','past_due','canceled','expired')),
  billing_type text NOT NULL CHECK (billing_type IN ('CREDIT_CARD','PIX','BOLETO','UNDEFINED')),
  is_beta boolean NOT NULL DEFAULT false,
  discount_percent numeric NOT NULL DEFAULT 0,
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  grace_until timestamptz,
  canceled_at timestamptz,
  last_payment_at timestamptz,
  next_due_date date,
  invoice_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_one_active_per_user
  ON public.subscriptions(user_id) WHERE status IN ('trialing','active','past_due');
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Log idempotente de webhooks
CREATE TABLE public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text NOT NULL,
  asaas_payment_id text,
  asaas_subscription_id text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
-- sem policy: só service role lê/grava

-- Função: status de assinatura efetivo
CREATE OR REPLACE FUNCTION public.has_active_subscription(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _uid
      AND (
        status = 'trialing' AND trial_ends_at > now()
        OR status = 'active'
        OR (status = 'past_due' AND grace_until > now())
      )
  )
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER asaas_customers_touch BEFORE UPDATE ON public.asaas_customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
