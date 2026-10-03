CREATE OR REPLACE FUNCTION public.inherit_company_from_account()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE acc_company uuid;
BEGIN
  IF NEW.credit_card_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.credit_cards WHERE id = NEW.credit_card_id;
    NEW.company_id := acc_company;
  ELSIF NEW.bank_account_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.bank_accounts WHERE id = NEW.bank_account_id;
    NEW.company_id := acc_company;
  ELSIF NEW.wallet_id IS NOT NULL THEN
    SELECT company_id INTO acc_company FROM public.wallets WHERE id = NEW.wallet_id;
    NEW.company_id := acc_company;
  END IF;
  RETURN NEW;
END;
$function$;