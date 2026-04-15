
-- Add company_id to pricing_v2_configurations
ALTER TABLE public.pricing_v2_configurations 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL DEFAULT NULL;

-- Add company_id to pricing_v2_cost_items
ALTER TABLE public.pricing_v2_cost_items 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL DEFAULT NULL;

-- Add company_id to pricing_v2_procedures
ALTER TABLE public.pricing_v2_procedures 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL DEFAULT NULL;
