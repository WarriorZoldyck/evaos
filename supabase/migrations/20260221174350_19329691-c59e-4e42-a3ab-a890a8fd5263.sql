
-- =============================================
-- Pricing V2: FHC Completo com Custo de Vida
-- =============================================

-- 1. Configurations table
CREATE TABLE public.pricing_v2_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hours_per_month integer NOT NULL DEFAULT 160,
  num_rooms integer NOT NULL DEFAULT 1,
  tax_rate numeric NOT NULL DEFAULT 8.44,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.pricing_v2_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pricing v2 config"
  ON public.pricing_v2_configurations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Cost items table
CREATE TABLE public.pricing_v2_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.pricing_v2_configurations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  cost_group text NOT NULL,
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  value numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'M',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.pricing_v2_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pricing v2 cost items"
  ON public.pricing_v2_cost_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Procedures table
CREATE TABLE public.pricing_v2_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  execution_time numeric NOT NULL DEFAULT 1.0,
  desired_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pricing_v2_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pricing v2 procedures"
  ON public.pricing_v2_procedures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Procedure items table
CREATE TABLE public.pricing_v2_procedure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.pricing_v2_procedures(id) ON DELETE CASCADE,
  description text NOT NULL DEFAULT '',
  value numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.pricing_v2_procedure_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pricing v2 procedure items"
  ON public.pricing_v2_procedure_items FOR ALL
  USING (procedure_id IN (
    SELECT id FROM public.pricing_v2_procedures WHERE user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX idx_pricing_v2_cost_items_config ON public.pricing_v2_cost_items(config_id);
CREATE INDEX idx_pricing_v2_cost_items_user ON public.pricing_v2_cost_items(user_id);
CREATE INDEX idx_pricing_v2_procedure_items_proc ON public.pricing_v2_procedure_items(procedure_id);
