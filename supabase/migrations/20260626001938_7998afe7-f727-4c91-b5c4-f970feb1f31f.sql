
CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
  message_id text PRIMARY KEY,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_processed_messages TO service_role;
ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_wa_processed_created ON public.whatsapp_processed_messages (created_at DESC);
