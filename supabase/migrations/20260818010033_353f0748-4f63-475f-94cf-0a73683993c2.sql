REVOKE ALL ON public.backup_renato_ctx_20260818 FROM anon, authenticated;
GRANT ALL ON public.backup_renato_ctx_20260818 TO service_role;
ALTER TABLE public.backup_renato_ctx_20260818 ENABLE ROW LEVEL SECURITY;