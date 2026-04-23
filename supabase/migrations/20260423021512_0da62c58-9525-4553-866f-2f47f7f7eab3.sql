-- Drop overly permissive policies on storage.objects for whatsapp-attachments
DROP POLICY IF EXISTS "Authenticated can read whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read own whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own whatsapp attachments" ON storage.objects;

-- Ownership-scoped SELECT (authenticated listing/reading restricted to user's own folder)
CREATE POLICY "Users can read own whatsapp attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Ownership-scoped INSERT
CREATE POLICY "Users can upload own whatsapp attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Ownership-scoped UPDATE
CREATE POLICY "Users can update own whatsapp attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'whatsapp-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Ownership-scoped DELETE
CREATE POLICY "Users can delete own whatsapp attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);