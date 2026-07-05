
-- 1. Correção retroativa: qualquer lançamento com transfer_id vira transferência interna
UPDATE public.transactions
   SET is_internal_transfer = true
 WHERE transfer_id IS NOT NULL
   AND is_internal_transfer = false;

-- 2. Trigger de invariante: transfer_id => is_internal_transfer=true (sempre)
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
