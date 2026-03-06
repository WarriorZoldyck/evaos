
-- Goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  name text NOT NULL,
  target_amount numeric NOT NULL DEFAULT 0,
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  auto_reserve_enabled boolean NOT NULL DEFAULT false,
  auto_reserve_frequency text, -- 'weekly', 'biweekly', 'monthly'
  auto_reserve_per_expense numeric DEFAULT 0,
  auto_reserve_per_sale numeric DEFAULT 0,
  auto_reserve_amount numeric DEFAULT 0,
  icon text DEFAULT 'lifebuoy',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goals"
  ON public.goals FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Goal movements history table
CREATE TABLE public.goal_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL, -- 'reserve' or 'withdraw'
  amount numeric NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.goal_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own goal movements"
  ON public.goal_movements FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
