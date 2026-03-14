
-- Table to store pending WhatsApp actions (e.g. category creation confirmation)
CREATE TABLE public.whatsapp_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL DEFAULT 'create_category',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_category_name text NOT NULL,
  category_type text NOT NULL DEFAULT 'despesa',
  context_company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- Enable RLS
ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can manage their own pending actions
CREATE POLICY "Users can manage their own pending actions"
  ON public.whatsapp_pending_actions
  FOR ALL
  TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by user_id
CREATE INDEX idx_whatsapp_pending_user ON public.whatsapp_pending_actions(user_id);
