CREATE TABLE transaction_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID,
    user_id UUID NOT NULL,
    company_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying by user or company
CREATE INDEX idx_audit_logs_user_id ON transaction_audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON transaction_audit_logs(company_id);
CREATE INDEX idx_audit_logs_created_at ON transaction_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE transaction_audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own logs or logs of their company
CREATE POLICY "Users can view their own audit logs"
    ON transaction_audit_logs FOR SELECT
    USING (auth.uid() = user_id OR (
        company_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM company_users WHERE company_id = transaction_audit_logs.company_id AND user_id = auth.uid()
        )
    ));

-- Create the trigger function
CREATE OR REPLACE FUNCTION log_transaction_audit()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        INSERT INTO transaction_audit_logs (transaction_id, user_id, company_id, action, old_data)
        VALUES (
            OLD.id, 
            coalesce(auth.uid(), OLD.user_id), 
            OLD.company_id, 
            'DELETE', 
            row_to_json(OLD)::jsonb
        );
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO transaction_audit_logs (transaction_id, user_id, company_id, action, old_data, new_data)
        VALUES (
            NEW.id, 
            coalesce(auth.uid(), NEW.user_id), 
            NEW.company_id, 
            'UPDATE', 
            row_to_json(OLD)::jsonb, 
            row_to_json(NEW)::jsonb
        );
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO transaction_audit_logs (transaction_id, user_id, company_id, action, new_data)
        VALUES (
            NEW.id, 
            coalesce(auth.uid(), NEW.user_id), 
            NEW.company_id, 
            'INSERT', 
            row_to_json(NEW)::jsonb
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER transaction_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION log_transaction_audit();
