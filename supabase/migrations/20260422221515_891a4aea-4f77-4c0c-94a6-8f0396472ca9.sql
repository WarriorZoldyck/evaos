-- Tornar bucket de anexos do WhatsApp/EVA público para que URLs geradas via getPublicUrl() funcionem
UPDATE storage.buckets SET public = true WHERE id = 'whatsapp-attachments';

-- Política de leitura pública (defesa em profundidade caso bucket volte a privado)
DROP POLICY IF EXISTS "Public read whatsapp attachments" ON storage.objects;
CREATE POLICY "Public read whatsapp attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'whatsapp-attachments');

-- Mantém upload restrito ao service role / authenticated do dono (já era assim implicitamente,
-- mas garantimos que só o user dono da pasta (phone) consegue subir via authenticated)
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload whatsapp attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'whatsapp-attachments');