ALTER TABLE public.transactions DISABLE TRIGGER trg_enforce_closed_bill_cycle;
UPDATE public.transactions t SET bank_account_id = c.bank_account_id
FROM public.credit_cards c WHERE t.credit_card_id = c.id AND t.bank_account_id IS NULL;
ALTER TABLE public.transactions ENABLE TRIGGER trg_enforce_closed_bill_cycle;

CREATE TABLE public.system_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.system_notices TO authenticated;
GRANT ALL ON public.system_notices TO service_role;
ALTER TABLE public.system_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notices read" ON public.system_notices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notices mark seen" ON public.system_notices FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.system_notices (user_id, title, body) VALUES
('3bde8282-526e-4ef4-b262-64c9e205c355', 'Atualização do sistema',
 'Fizemos uma atualização no EVA OS: seus lançamentos de cartão antigos agora aparecem ligados à conta que paga a fatura. Assim, os filtros por conta e o valor de "Pagar fatura" passam a bater. Nenhum valor foi alterado.');

CREATE OR REPLACE FUNCTION public.validate_transaction_required()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.description IS NULL OR btrim(NEW.description) = '' THEN
    RAISE EXCEPTION 'Descrição é obrigatória' USING ERRCODE = '23514';
  END IF;
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero' USING ERRCODE = '23514';
  END IF;
  IF NEW.bank_account_id IS NULL AND NEW.credit_card_id IS NULL AND NEW.wallet_id IS NULL AND NEW.card_terminal_id IS NULL THEN
    RAISE EXCEPTION 'Informe conta, cartão, carteira ou maquininha' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_transaction_required BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.validate_transaction_required();