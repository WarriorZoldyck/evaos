CREATE OR REPLACE FUNCTION public.fill_card_bank_account()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.credit_card_id IS NOT NULL AND NEW.bank_account_id IS NULL THEN
    SELECT bank_account_id INTO NEW.bank_account_id FROM public.credit_cards WHERE id = NEW.credit_card_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fill_card_bank_account ON public.transactions;
CREATE TRIGGER trg_fill_card_bank_account BEFORE INSERT OR UPDATE OF credit_card_id, bank_account_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fill_card_bank_account();