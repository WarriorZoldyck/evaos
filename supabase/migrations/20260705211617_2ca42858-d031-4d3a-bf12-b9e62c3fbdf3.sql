
CREATE OR REPLACE FUNCTION public.inherit_company_from_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.bank_account_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_inherit_company ON public.transactions;

CREATE TRIGGER transactions_inherit_company
BEFORE INSERT OR UPDATE OF bank_account_id, company_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.inherit_company_from_account();
