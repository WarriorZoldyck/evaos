
-- Create whatsapp-attachments storage bucket (public for readable URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-attachments', 'whatsapp-attachments', true);

-- Allow public read access to all files in the bucket
CREATE POLICY "Public read access for whatsapp attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-attachments');

-- Allow service role (edge functions) to insert files
CREATE POLICY "Service role can upload whatsapp attachments"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'whatsapp-attachments');
