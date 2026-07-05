
CREATE OR REPLACE FUNCTION public.inherit_company_from_account()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  acc_company uuid;
BEGIN
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    NEW.company_id := acc_company;
  ELSIF NEW.wallet_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.wallets WHERE id = NEW.wallet_id;
    NEW.company_id := acc_company;
  ELSIF NEW.credit_card_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.credit_cards WHERE id = NEW.credit_card_id;
    NEW.company_id := acc_company;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_inherit_company_from_account_ins ON public.transactions;
DROP TRIGGER IF EXISTS trg_inherit_company_from_account_upd ON public.transactions;
DROP TRIGGER IF EXISTS trg_inherit_company_from_account ON public.transactions;

CREATE TRIGGER trg_inherit_company_from_account_ins
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.inherit_company_from_account();

CREATE TRIGGER trg_inherit_company_from_account_upd
BEFORE UPDATE OF bank_account_id, wallet_id, credit_card_id, company_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.inherit_company_from_account();
