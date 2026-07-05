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

CREATE OR REPLACE FUNCTION public.enforce_transfer_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.transfer_id IS NOT NULL AND NEW.is_internal_transfer IS DISTINCT FROM true THEN
    NEW.is_internal_transfer := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_enforce_transfer_flag ON public.transactions;
CREATE TRIGGER transactions_enforce_transfer_flag
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transfer_flag();

CREATE OR REPLACE FUNCTION public.validate_transfer_no_credit_card()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.transfer_id IS NOT NULL AND NEW.credit_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Transferências entre contas não podem ser vinculadas a cartão de crédito (transfer_id=% credit_card_id=%)', NEW.transfer_id, NEW.credit_card_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_transfer_no_credit_card ON public.transactions;
CREATE TRIGGER trg_validate_transfer_no_credit_card
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_no_credit_card();