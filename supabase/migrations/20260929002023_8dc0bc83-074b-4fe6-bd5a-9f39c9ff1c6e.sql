CREATE TABLE IF NOT EXISTS public.eva_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  content text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eva_knowledge_status_chk CHECK (status IN ('pending','processing','active','error'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eva_knowledge TO authenticated;
GRANT ALL ON public.eva_knowledge TO service_role;
ALTER TABLE public.eva_knowledge ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS eva_knowledge_user_idx ON public.eva_knowledge(user_id, company_id);

CREATE POLICY "eva_knowledge_select" ON public.eva_knowledge FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member(auth.uid(), user_id));
CREATE POLICY "eva_knowledge_insert" ON public.eva_knowledge FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "eva_knowledge_update" ON public.eva_knowledge FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member_writer(auth.uid(), user_id));
CREATE POLICY "eva_knowledge_delete" ON public.eva_knowledge FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "eva_knowledge_obj_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eva-knowledge' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_hub_member_writer(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "eva_knowledge_obj_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eva-knowledge' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_hub_member(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY "eva_knowledge_obj_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eva-knowledge' AND (auth.uid()::text = (storage.foldername(name))[1]
    OR public.is_hub_member_writer(auth.uid(), ((storage.foldername(name))[1])::uuid)));