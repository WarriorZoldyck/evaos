-- Performance index for owner queries on audit log
CREATE INDEX IF NOT EXISTS idx_hub_audit_owner_created
  ON public.hub_audit_log (owner_id, created_at DESC);

-- Retention purge function: delete audit rows older than 180 days
CREATE OR REPLACE FUNCTION public.purge_old_hub_audit_log()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.hub_audit_log
  WHERE created_at < (now() - interval '180 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;