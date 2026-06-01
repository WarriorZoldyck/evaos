WITH first_inst AS (
  SELECT series_id, payment_date AS base_pd
  FROM public.transactions
  WHERE credit_card_id = '3533ea3a-6a17-4316-af2b-0071fc64cddd'
    AND installment_number = 1
    AND series_id IS NOT NULL
)
UPDATE public.transactions t
SET payment_date = (fi.base_pd + ((t.installment_number - 1) || ' months')::interval)::date
FROM first_inst fi
WHERE t.series_id = fi.series_id
  AND t.installment_number > 1
  AND t.credit_card_id = '3533ea3a-6a17-4316-af2b-0071fc64cddd'
  AND t.status = 'Pendente'
  AND t.payment_date <> (fi.base_pd + ((t.installment_number - 1) || ' months')::interval)::date;