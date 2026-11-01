ALTER TABLE public.ai_pending_transactions ADD COLUMN approved_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;
CREATE OR REPLACE FUNCTION public.validate_approved_transaction_owner() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.approved_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = NEW.approved_transaction_id AND t.user_id = NEW.user_id) THEN
  RAISE EXCEPTION 'Lançamento aprovado deve pertencer ao mesmo proprietário.' USING ERRCODE = '42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_approved_transaction_owner() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_approved_transaction_owner BEFORE INSERT OR UPDATE OF approved_transaction_id, user_id ON public.ai_pending_transactions FOR EACH ROW EXECUTE FUNCTION public.validate_approved_transaction_owner();
CREATE TABLE public.budget_approval_notifications (
 pending_id uuid PRIMARY KEY REFERENCES public.ai_pending_transactions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending','accepted','failed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.budget_approval_notifications TO service_role;
REVOKE ALL ON public.budget_approval_notifications FROM anon, authenticated;
ALTER TABLE public.budget_approval_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages approval notifications" ON public.budget_approval_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER budget_approval_notifications_updated_at BEFORE UPDATE ON public.budget_approval_notifications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();