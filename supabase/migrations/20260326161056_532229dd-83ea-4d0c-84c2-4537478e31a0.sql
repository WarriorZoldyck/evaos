
-- Create ai_pending_transactions table for staging AI-generated transactions
CREATE TABLE public.ai_pending_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'pending',
  confidence_score numeric,
  ai_response_message text,
  original_message text,
  reviewed_at timestamp with time zone,

  -- Mirror transactions columns
  description text NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL,
  category text,
  subcategory text,
  subcategory2 text,
  competence_date date,
  payment_date date,
  transaction_status text DEFAULT 'Pago',
  bank_account_id uuid,
  wallet_id uuid,
  credit_card_id uuid,
  card_terminal_id uuid,
  company_id uuid,
  payment_method text,
  supplier_id uuid,
  client_id uuid,
  contact_name text,
  notes text,
  attachment_url text,
  barcode text,
  installments integer DEFAULT 1,
  installment_number integer,
  installments_total integer,
  series_id uuid,
  original_amount numeric,

  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_pending_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their own ai pending transactions"
  ON public.ai_pending_transactions
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast pending lookups
CREATE INDEX idx_ai_pending_transactions_user_status ON public.ai_pending_transactions (user_id, status);
