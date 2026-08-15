CREATE TABLE public.budget_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  category_name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  target_amount numeric NOT NULL DEFAULT 0 CHECK (target_amount >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX budget_targets_unique_ctx
  ON public.budget_targets (user_id, kind, category_name, COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX budget_targets_user_idx ON public.budget_targets (user_id, company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_targets TO authenticated;
GRANT ALL ON public.budget_targets TO service_role;

ALTER TABLE public.budget_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own budget targets"
  ON public.budget_targets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Hub members can view owner budget targets"
  ON public.budget_targets FOR SELECT TO authenticated
  USING (public.is_hub_member(auth.uid(), user_id));

CREATE POLICY "Hub writers can insert owner budget targets"
  ON public.budget_targets FOR INSERT TO authenticated
  WITH CHECK (public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "Hub writers can update owner budget targets"
  ON public.budget_targets FOR UPDATE TO authenticated
  USING (public.is_hub_member_writer(auth.uid(), user_id))
  WITH CHECK (public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "Hub writers can delete owner budget targets"
  ON public.budget_targets FOR DELETE TO authenticated
  USING (public.is_hub_member_writer(auth.uid(), user_id));

CREATE TRIGGER budget_targets_touch
  BEFORE UPDATE ON public.budget_targets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();