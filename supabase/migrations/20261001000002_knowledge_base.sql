CREATE TABLE IF NOT EXISTS public.eva_knowledge (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    company_id uuid,
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_path text NOT NULL,
    status text DEFAULT 'pending' NOT NULL, -- pending, processing, active, error
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.eva_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own knowledge" 
    ON public.eva_knowledge FOR ALL 
    USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public) VALUES ('eva-knowledge', 'eva-knowledge', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload knowledge files"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'eva-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read own knowledge files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'eva-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own knowledge files"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'eva-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);
