
-- Add input validation constraints to transactions table
ALTER TABLE public.transactions
  ADD CONSTRAINT chk_transactions_description_length CHECK (length(description) <= 500),
  ADD CONSTRAINT chk_transactions_amount_nonneg CHECK (amount >= 0);

-- Add input validation constraints to recurring_transactions table
ALTER TABLE public.recurring_transactions
  ADD CONSTRAINT chk_recurring_description_length CHECK (length(description) <= 500),
  ADD CONSTRAINT chk_recurring_amount_nonneg CHECK (amount >= 0);

-- Add input validation constraints to profiles table
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_full_name_length CHECK (full_name IS NULL OR length(full_name) <= 200),
  ADD CONSTRAINT chk_profiles_cpf_format CHECK (cpf IS NULL OR cpf ~ '^\d{11}$');

-- Add input validation constraints to bank_accounts table
ALTER TABLE public.bank_accounts
  ADD CONSTRAINT chk_bank_accounts_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to categories table
ALTER TABLE public.categories
  ADD CONSTRAINT chk_categories_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to companies table
ALTER TABLE public.companies
  ADD CONSTRAINT chk_companies_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to credit_cards table
ALTER TABLE public.credit_cards
  ADD CONSTRAINT chk_credit_cards_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to wallets table
ALTER TABLE public.wallets
  ADD CONSTRAINT chk_wallets_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to suppliers table
ALTER TABLE public.suppliers
  ADD CONSTRAINT chk_suppliers_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to clients table
ALTER TABLE public.clients
  ADD CONSTRAINT chk_clients_name_length CHECK (length(name) <= 200);

-- Add input validation constraints to card_terminals table
ALTER TABLE public.card_terminals
  ADD CONSTRAINT chk_card_terminals_name_length CHECK (length(name) <= 200);
