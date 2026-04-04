
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS is_internal_transfer boolean DEFAULT false;

-- Classify existing transfers: internal when both sides share the same company_id
UPDATE transactions t1
SET is_internal_transfer = true
FROM transactions t2
WHERE t1.transfer_id IS NOT NULL
  AND t1.transfer_id = t2.transfer_id
  AND t1.id != t2.id
  AND t1.company_id IS NOT DISTINCT FROM t2.company_id;
