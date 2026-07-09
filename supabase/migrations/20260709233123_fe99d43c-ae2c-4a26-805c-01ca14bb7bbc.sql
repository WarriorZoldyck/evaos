
-- 1. Tabela de fechamentos
CREATE TABLE public.closed_bill_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credit_card_id uuid REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  cycle_key text NOT NULL, -- 'YYYY-MM' derivado do payment_date
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closed_bill_cycles_scope_chk CHECK (
    (credit_card_id IS NOT NULL AND bank_account_id IS NULL)
    OR (credit_card_id IS NULL AND bank_account_id IS NOT NULL)
  ),
  CONSTRAINT closed_bill_cycles_cycle_key_fmt CHECK (cycle_key ~ '^\d{4}-\d{2}$')
);

CREATE UNIQUE INDEX closed_bill_cycles_card_uq
  ON public.closed_bill_cycles(user_id, credit_card_id, cycle_key)
  WHERE credit_card_id IS NOT NULL;

CREATE UNIQUE INDEX closed_bill_cycles_bank_uq
  ON public.closed_bill_cycles(user_id, bank_account_id, cycle_key)
  WHERE bank_account_id IS NOT NULL;

CREATE INDEX closed_bill_cycles_user_idx ON public.closed_bill_cycles(user_id);

-- 2. GRANTs (obrigatório)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closed_bill_cycles TO authenticated;
GRANT ALL ON public.closed_bill_cycles TO service_role;

-- 3. RLS
ALTER TABLE public.closed_bill_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner or workspace member can view closed cycles"
  ON public.closed_bill_cycles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id));

CREATE POLICY "owner or workspace writer can insert closed cycles"
  ON public.closed_bill_cycles FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND closed_by = auth.uid())
    OR (public.is_hub_member_writer(auth.uid(), user_id) AND closed_by = auth.uid())
  );

CREATE POLICY "owner or workspace writer can update closed cycles"
  ON public.closed_bill_cycles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id))
  WITH CHECK (user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id));

CREATE POLICY "owner or workspace writer can delete closed cycles"
  ON public.closed_bill_cycles FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_hub_member_writer(auth.uid(), user_id));

-- 4. Função utilitária: cycle_key = YYYY-MM do payment_date
CREATE OR REPLACE FUNCTION public.compute_cycle_key(payment_date date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT to_char(payment_date, 'YYYY-MM')
$$;

-- 5. Trigger que bloqueia mutações em faturas/meses fechados
CREATE OR REPLACE FUNCTION public.enforce_closed_bill_cycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _row public.transactions;
  _closed_at timestamptz;
  _scope text;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    _row := OLD;
  ELSE
    _row := NEW;
  END IF;

  IF _row.payment_date IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Cartão
  IF _row.credit_card_id IS NOT NULL THEN
    SELECT closed_at INTO _closed_at FROM public.closed_bill_cycles
      WHERE user_id = _row.user_id
        AND credit_card_id = _row.credit_card_id
        AND cycle_key = public.compute_cycle_key(_row.payment_date)
      LIMIT 1;
    IF _closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Fatura fechada em % — reabra o mês para editar.', to_char(_closed_at, 'DD/MM/YYYY')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Conta bancária
  IF _row.bank_account_id IS NOT NULL THEN
    SELECT closed_at INTO _closed_at FROM public.closed_bill_cycles
      WHERE user_id = _row.user_id
        AND bank_account_id = _row.bank_account_id
        AND cycle_key = public.compute_cycle_key(_row.payment_date)
      LIMIT 1;
    IF _closed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Mês fechado em % — reabra o mês para editar.', to_char(_closed_at, 'DD/MM/YYYY')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Se for UPDATE, também bloqueia caso o VALOR ANTIGO estivesse em ciclo fechado
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.credit_card_id IS NOT NULL AND OLD.payment_date IS NOT NULL THEN
      SELECT closed_at INTO _closed_at FROM public.closed_bill_cycles
        WHERE user_id = OLD.user_id
          AND credit_card_id = OLD.credit_card_id
          AND cycle_key = public.compute_cycle_key(OLD.payment_date)
        LIMIT 1;
      IF _closed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Fatura fechada em % — reabra o mês para editar.', to_char(_closed_at, 'DD/MM/YYYY')
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
    IF OLD.bank_account_id IS NOT NULL AND OLD.payment_date IS NOT NULL THEN
      SELECT closed_at INTO _closed_at FROM public.closed_bill_cycles
        WHERE user_id = OLD.user_id
          AND bank_account_id = OLD.bank_account_id
          AND cycle_key = public.compute_cycle_key(OLD.payment_date)
        LIMIT 1;
      IF _closed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Mês fechado em % — reabra o mês para editar.', to_char(_closed_at, 'DD/MM/YYYY')
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_closed_bill_cycle ON public.transactions;
CREATE TRIGGER trg_enforce_closed_bill_cycle
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_closed_bill_cycle();
