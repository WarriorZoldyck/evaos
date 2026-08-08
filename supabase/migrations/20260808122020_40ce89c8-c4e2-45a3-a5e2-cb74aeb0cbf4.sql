ALTER TABLE public.pricing_v2_procedure_items
  ADD COLUMN IF NOT EXISTS unit_type text NOT NULL DEFAULT 'sessao';

ALTER TABLE public.pricing_v2_procedure_items
  ADD CONSTRAINT pricing_v2_procedure_items_unit_type_check
  CHECK (unit_type IN ('sessao','unitario'));

ALTER TABLE public.pricing_v2_procedures
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.pricing_v2_procedures
  ADD CONSTRAINT pricing_v2_procedures_quantity_check
  CHECK (quantity >= 1);