ALTER TABLE public.card_terminals
  ADD COLUMN auto_anticipation boolean NOT NULL DEFAULT false;

UPDATE public.card_terminals
  SET auto_anticipation = true
  WHERE settlement_days_credit IS NOT NULL AND settlement_days_credit < 30;