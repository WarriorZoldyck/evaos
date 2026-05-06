-- 1. Make whatsapp-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'whatsapp-attachments';

-- 2. Revoke execute on internal schema-introspection functions
REVOKE EXECUTE ON FUNCTION public.get_public_tables() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.list_tables() FROM anon, authenticated, public;
