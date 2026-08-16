DROP INDEX IF EXISTS public.budget_targets_unique_ctx;

ALTER TABLE public.budget_targets
  ADD CONSTRAINT budget_targets_unique_ctx
  UNIQUE NULLS NOT DISTINCT (user_id, kind, category_name, company_id);