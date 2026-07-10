
-- Sum paid receitas/despesas across multiple bank accounts + wallets, no row limit
CREATE OR REPLACE FUNCTION public.get_accounts_paid_delta(
  bank_ids uuid[],
  wallet_ids uuid[]
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN t.type = 'receita' THEN t.amount ELSE -t.amount END
  ), 0)::numeric
  FROM public.transactions t
  WHERE t.status = 'Pago'
    AND t.user_id = auth.uid()
    AND (
      (bank_ids IS NOT NULL AND array_length(bank_ids, 1) > 0 AND t.bank_account_id = ANY(bank_ids))
      OR
      (wallet_ids IS NOT NULL AND array_length(wallet_ids, 1) > 0 AND t.wallet_id = ANY(wallet_ids))
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_accounts_paid_delta(uuid[], uuid[]) TO authenticated;

-- Prior balance for a single bank account or wallet (all paid transactions before date_from)
CREATE OR REPLACE FUNCTION public.get_account_prior_balance(
  account_id_param uuid,
  account_type_param text,
  date_from date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE WHEN t.type = 'receita' THEN t.amount ELSE -t.amount END
  ), 0)::numeric
  FROM public.transactions t
  WHERE t.status = 'Pago'
    AND t.user_id = auth.uid()
    AND t.payment_date < date_from
    AND (
      (account_type_param = 'bank'   AND t.bank_account_id = account_id_param)
      OR
      (account_type_param = 'wallet' AND t.wallet_id       = account_id_param)
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_account_prior_balance(uuid, text, date) TO authenticated;
