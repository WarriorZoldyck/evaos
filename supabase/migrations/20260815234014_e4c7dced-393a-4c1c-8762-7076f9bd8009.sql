ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'sonho',
  ADD COLUMN IF NOT EXISTS allocation_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS allocation_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_goal_type_check
  CHECK (goal_type IN ('reserva','sonho','investimento','divida','outro'));

ALTER TABLE public.goals
  ADD CONSTRAINT goals_allocation_mode_check
  CHECK (allocation_mode IN ('fixed','percent'));

ALTER TABLE public.goals
  ADD CONSTRAINT goals_allocation_percent_check
  CHECK (allocation_percent >= 0 AND allocation_percent <= 100);