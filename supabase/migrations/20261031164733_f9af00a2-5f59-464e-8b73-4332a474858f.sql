REVOKE ALL ON FUNCTION public.increment_ai_usage(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.purge_old_hub_audit_log() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_hub_audit_log() TO service_role;
REVOKE ALL ON FUNCTION public.enforce_subscription_delinquency() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_delinquency() TO service_role;
REVOKE ALL ON FUNCTION public.check_eva_subscriber_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_eva_subscriber_by_email(text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_hub_invitation_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    IF OLD.member_user_id IS DISTINCT FROM auth.uid() OR OLD.status <> 'pending'
       OR NEW.status NOT IN ('pending', 'active')
       OR (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
      RAISE EXCEPTION 'Somente o proprietário pode alterar os dados e permissões do membro.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_hub_invitation_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_hub_invitation_update BEFORE UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.guard_hub_invitation_update();