-- Reverte o pagamento errado da fatura do MASTERCARD BLACK (usuário espclin@hotmail.com)
-- e recalcula payment_date com base no ciclo do cartão (closing 14 / due 21).
--
-- Card: 3533ea3a-6a17-4316-af2b-0071fc64cddd
-- User: b049592f-d97a-468d-a839-ed02c2a41d9b
--
-- Regra: due_day(21) > closing_day(14)  =>  dueMonth = billMonth
--   billMonth = (compDay >= 14) ? compMonth+1 : compMonth
--
-- Escopo: somente lançamentos com payment_date = 2026-03-21 no cartão,
-- que foi a fatura corrompida pelo bug. Lançamentos paid em jan/fev ficam intactos.

DO $$
DECLARE
  v_user uuid := 'b049592f-d97a-468d-a839-ed02c2a41d9b';
  v_card uuid := '3533ea3a-6a17-4316-af2b-0071fc64cddd';
  v_closing int := 14;
  v_due int := 21;
  r record;
  v_comp_day int;
  v_comp_month int;
  v_comp_year int;
  v_bill_month int;
  v_bill_year int;
  v_due_date date;
BEGIN
  FOR r IN
    SELECT id, competence_date
    FROM public.transactions
    WHERE user_id = v_user
      AND credit_card_id = v_card
      AND payment_date = DATE '2026-03-21'
  LOOP
    v_comp_day   := EXTRACT(DAY   FROM r.competence_date)::int;
    v_comp_month := EXTRACT(MONTH FROM r.competence_date)::int;
    v_comp_year  := EXTRACT(YEAR  FROM r.competence_date)::int;

    IF v_comp_day >= v_closing THEN
      v_bill_month := v_comp_month + 1;
      v_bill_year  := v_comp_year;
      IF v_bill_month > 12 THEN
        v_bill_month := v_bill_month - 12;
        v_bill_year  := v_bill_year + 1;
      END IF;
    ELSE
      v_bill_month := v_comp_month;
      v_bill_year  := v_comp_year;
    END IF;

    -- due_day > closing_day, então dueMonth = billMonth
    v_due_date := make_date(v_bill_year, v_bill_month, v_due);

    UPDATE public.transactions
       SET status            = 'Pendente',
           bank_account_id   = NULL,
           liquidation_notes = NULL,
           payment_date      = v_due_date
     WHERE id = r.id;
  END LOOP;
END $$;
