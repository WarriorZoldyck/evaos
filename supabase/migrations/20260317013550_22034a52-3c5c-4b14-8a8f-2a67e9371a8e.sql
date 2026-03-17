
ALTER TABLE public.whatsapp_pending_actions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
