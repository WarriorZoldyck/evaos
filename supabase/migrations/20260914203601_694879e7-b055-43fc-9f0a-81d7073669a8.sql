
-- 1. Acesso considerando ausência de assinatura
CREATE OR REPLACE FUNCTION public.subscription_access_ok(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = _uid)
      OR public.has_active_subscription(_uid)
$$;

-- 2. Rotina de inadimplência
CREATE OR REPLACE FUNCTION public.enforce_subscription_delinquency()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
  c integer;
BEGIN
  -- ativas com vencimento passado -> pendente com 5 dias de tolerância
  UPDATE public.subscriptions
     SET status = 'past_due',
         grace_until = now() + interval '5 days'
   WHERE status = 'active'
     AND next_due_date IS NOT NULL
     AND next_due_date < CURRENT_DATE
     AND (current_period_end IS NULL OR current_period_end < now());
  GET DIAGNOSTICS c = ROW_COUNT; affected := affected + c;

  -- tolerância vencida -> expirada
  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE status = 'past_due'
     AND grace_until IS NOT NULL
     AND grace_until < now();
  GET DIAGNOSTICS c = ROW_COUNT; affected := affected + c;

  -- teste vencido -> expirada
  UPDATE public.subscriptions
     SET status = 'expired'
   WHERE status = 'trialing'
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < now();
  GET DIAGNOSTICS c = ROW_COUNT; affected := affected + c;

  RETURN affected;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('enforce-subscription-delinquency')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enforce-subscription-delinquency');

SELECT cron.schedule(
  'enforce-subscription-delinquency',
  '10 6 * * *',
  $$ SELECT public.enforce_subscription_delinquency(); $$
);

-- 3. Bloqueio de escrita para inadimplentes (leitura continua liberada)
DO $do$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transactions','recurring_transactions','bank_accounts','credit_cards','wallets','categories']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "sub_block_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sub_block_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sub_block_delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "sub_block_insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.subscription_access_ok(user_id))', t);
    EXECUTE format('CREATE POLICY "sub_block_update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.subscription_access_ok(user_id)) WITH CHECK (public.subscription_access_ok(user_id))', t);
    EXECUTE format('CREATE POLICY "sub_block_delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.subscription_access_ok(user_id))', t);
  END LOOP;
END
$do$;
