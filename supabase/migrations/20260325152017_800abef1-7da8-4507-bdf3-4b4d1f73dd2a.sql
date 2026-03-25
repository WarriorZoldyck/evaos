
-- Remove duplicate transactions keeping only the oldest (smallest created_at) per (user_id, external_id)
DELETE FROM public.transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY user_id, external_id
      ORDER BY created_at ASC
    ) AS rn
    FROM public.transactions
    WHERE external_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Create unique partial index on (user_id, external_id)
CREATE UNIQUE INDEX idx_transactions_user_external_id_unique
ON public.transactions (user_id, external_id)
WHERE external_id IS NOT NULL;
