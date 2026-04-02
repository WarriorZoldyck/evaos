
-- Add ownership-based INSERT policy for whatsapp-attachments
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload whatsapp attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add ownership-based DELETE policy
DROP POLICY IF EXISTS "Users can delete own whatsapp attachments" ON storage.objects;
CREATE POLICY "Users can delete own whatsapp attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'whatsapp-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Restrict SELECT to authenticated users who own the file
-- (replaces any existing public read policy)
DROP POLICY IF EXISTS "Public read access for whatsapp attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read own whatsapp attachments" ON storage.objects;
CREATE POLICY "Authenticated users can read own whatsapp attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'whatsapp-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
