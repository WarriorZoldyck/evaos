ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_import_fingerprint_uidx
  ON public.transactions (user_id, import_fingerprint)
  WHERE import_fingerprint IS NOT NULL;