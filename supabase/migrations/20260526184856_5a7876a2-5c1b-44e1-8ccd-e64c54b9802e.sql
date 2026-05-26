
-- Drop broad ALL-command policies that allowed any hub member to write
DROP POLICY IF EXISTS "Users and hub members can manage pricing" ON public.pricing_configurations;
DROP POLICY IF EXISTS "Users and hub members can manage pricing v2 config" ON public.pricing_v2_configurations;
DROP POLICY IF EXISTS "Users and hub members can manage pricing procedure items" ON public.pricing_procedure_items;
DROP POLICY IF EXISTS "Users and hub members can manage pricing v2 procedure items" ON public.pricing_v2_procedure_items;

-- pricing_procedure_items: add fine-grained policies (viewer read; writer write)
CREATE POLICY "Owner and hub viewers can read pricing_procedure_items"
ON public.pricing_procedure_items FOR SELECT
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can insert pricing_procedure_items"
ON public.pricing_procedure_items FOR INSERT
WITH CHECK (
  procedure_id IN (
    SELECT id FROM public.pricing_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can update pricing_procedure_items"
ON public.pricing_procedure_items FOR UPDATE
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
)
WITH CHECK (
  procedure_id IN (
    SELECT id FROM public.pricing_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can delete pricing_procedure_items"
ON public.pricing_procedure_items FOR DELETE
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);

-- pricing_v2_procedure_items: same split
CREATE POLICY "Owner and hub viewers can read pricing_v2_procedure_items"
ON public.pricing_v2_procedure_items FOR SELECT
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can insert pricing_v2_procedure_items"
ON public.pricing_v2_procedure_items FOR INSERT
WITH CHECK (
  procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can update pricing_v2_procedure_items"
ON public.pricing_v2_procedure_items FOR UPDATE
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
)
WITH CHECK (
  procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);

CREATE POLICY "Owner and hub writers can delete pricing_v2_procedure_items"
ON public.pricing_v2_procedure_items FOR DELETE
USING (
  procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures
    WHERE user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id)
  )
);
