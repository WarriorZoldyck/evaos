CREATE INDEX IF NOT EXISTS idx_transactions_card_competence
  ON public.transactions (credit_card_id, competence_date)
  WHERE credit_card_id IS NOT NULL;