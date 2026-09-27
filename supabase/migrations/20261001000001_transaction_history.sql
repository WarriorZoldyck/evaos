CREATE TABLE IF NOT EXISTS public.transaction_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_logs_transaction_id ON public.transaction_logs (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_user_id ON public.transaction_logs (user_id);

ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transaction logs" ON public.transaction_logs;
CREATE POLICY "Users can view their own transaction logs" 
    ON public.transaction_logs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.transaction_logs (transaction_id, user_id, action, new_data, changed_by)
        VALUES (NEW.id, NEW.user_id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only log if something actually changed
        IF row_to_json(OLD)::jsonb != row_to_json(NEW)::jsonb THEN
            INSERT INTO public.transaction_logs (transaction_id, user_id, action, old_data, new_data, changed_by)
            VALUES (NEW.id, NEW.user_id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.transaction_logs (transaction_id, user_id, action, old_data, changed_by)
        VALUES (OLD.id, OLD.user_id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_transaction_changes ON public.transactions;
CREATE TRIGGER trg_transaction_changes
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.log_transaction_changes();
