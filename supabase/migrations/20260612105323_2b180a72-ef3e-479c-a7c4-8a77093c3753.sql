-- Clean up any existing bad data
UPDATE public.transactions
SET credit_card_id = NULL
WHERE transfer_id IS NOT NULL
  AND credit_card_id IS NOT NULL;

-- Validation trigger: transfers cannot have credit_card_id
CREATE OR REPLACE FUNCTION public.validate_transfer_no_credit_card()
RETURNS TRIGGER
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
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transfer_no_credit_card();