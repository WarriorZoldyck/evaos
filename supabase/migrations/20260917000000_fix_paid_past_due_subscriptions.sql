-- Migration: Correção de assinaturas pagas presas em past_due e contagem de status

-- 1. Regularizar assinaturas marcadas como past_due que têm pagamento recente ou vencimento futuro
UPDATE public.subscriptions
SET status = 'active',
    grace_until = NULL,
    updated_at = now()
WHERE status = 'past_due'
  AND (
    (last_payment_at IS NOT NULL AND last_payment_at >= now() - interval '35 days')
    OR (next_due_date IS NOT NULL AND next_due_date >= current_date)
    OR (current_period_end IS NOT NULL AND current_period_end > now())
  );

-- 2. Função segura para consultar o resumo de assinaturas em carência e bloqueadas
CREATE OR REPLACE FUNCTION public.get_subscription_status_summary()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _in_grace_count int;
  _blocked_count int;
  _active_count int;
  _trialing_count int;
BEGIN
  -- Usuários vendo o aviso de bloqueio (past_due com grace_until futuro)
  SELECT count(DISTINCT user_id) INTO _in_grace_count
  FROM public.subscriptions
  WHERE status = 'past_due'
    AND grace_until IS NOT NULL
    AND grace_until > now();

  -- Usuários bloqueados (past_due com grace expirado, ou status expired/canceled sem outra assinatura ativa)
  SELECT count(DISTINCT s.user_id) INTO _blocked_count
  FROM public.subscriptions s
  WHERE (
    (s.status = 'past_due' AND (s.grace_until IS NULL OR s.grace_until <= now()))
    OR s.status IN ('expired', 'canceled')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions sub
    WHERE sub.user_id = s.user_id
      AND (sub.status = 'active' OR (sub.status = 'trialing' AND sub.trial_ends_at > now()))
  );

  SELECT count(DISTINCT user_id) INTO _active_count
  FROM public.subscriptions
  WHERE status = 'active';

  SELECT count(DISTINCT user_id) INTO _trialing_count
  FROM public.subscriptions
  WHERE status = 'trialing'
    AND trial_ends_at > now();

  RETURN jsonb_build_object(
    'in_grace_warning', _in_grace_count,
    'blocked', _blocked_count,
    'active', _active_count,
    'trialing', _trialing_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subscription_status_summary() TO authenticated, service_role;
