UPDATE public.transactions t
SET user_id = co.user_id
FROM public.companies co
WHERE co.id = t.company_id
  AND t.user_id IS DISTINCT FROM co.user_id
  AND (
    t.credit_card_id IS NULL OR EXISTS (SELECT 1 FROM public.credit_cards cc WHERE cc.id=t.credit_card_id AND cc.user_id=co.user_id)
  )
  AND (
    t.bank_account_id IS NULL OR EXISTS (SELECT 1 FROM public.bank_accounts ba WHERE ba.id=t.bank_account_id AND ba.user_id=co.user_id)
  )
  AND (
    t.wallet_id IS NULL OR EXISTS (SELECT 1 FROM public.wallets w WHERE w.id=t.wallet_id AND w.user_id=co.user_id)
  );