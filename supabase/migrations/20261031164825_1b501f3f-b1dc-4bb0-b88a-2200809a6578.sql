ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_status_check;
CREATE OR REPLACE FUNCTION public.validate_subscription_status() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('trialing','active','past_due','pending','canceled','expired') THEN
    RAISE EXCEPTION 'Status de assinatura inválido' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_subscription_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_subscription_status BEFORE INSERT OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_status();