-- Substituir política de SELECT pública broad por uma que ainda permite getPublicUrl()
-- funcionar (URL direta com nome do objeto), mas não permite listagem (LIST) por anônimos.
-- O Supabase storage usa SELECT em storage.objects tanto pra GET de objeto quanto pra LIST.
-- Para evitar listagem por anônimos, restringimos SELECT a authenticated users + service_role.
-- O acesso público ao arquivo continua via /object/public/<bucket>/<path> (não passa por RLS de SELECT).

DROP POLICY IF EXISTS "Public read whatsapp attachments" ON storage.objects;

-- Apenas usuários autenticados podem listar/select arquivos do bucket via SDK
-- (URL pública continua funcionando porque o endpoint /object/public/ não exige RLS)
CREATE POLICY "Authenticated can read whatsapp attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'whatsapp-attachments');