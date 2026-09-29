REVOKE ALL ON public.transaction_audit_logs FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_ai_pending() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_import_batch(uuid, integer, numeric, text) FROM PUBLIC, anon;