
CREATE TABLE public.whatsapp_active_owner (
  member_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_active_owner TO authenticated;
GRANT ALL ON public.whatsapp_active_owner TO service_role;

ALTER TABLE public.whatsapp_active_owner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own active owner"
ON public.whatsapp_active_owner
FOR ALL
TO authenticated
USING (auth.uid() = member_user_id)
WITH CHECK (auth.uid() = member_user_id);

CREATE TRIGGER trg_whatsapp_active_owner_touch
BEFORE UPDATE ON public.whatsapp_active_owner
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_created_by_user_id ON public.transactions(created_by_user_id);
