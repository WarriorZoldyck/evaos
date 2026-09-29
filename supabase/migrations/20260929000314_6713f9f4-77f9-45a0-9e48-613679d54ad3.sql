CREATE TABLE public.transaction_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transaction_audit_logs TO authenticated;
GRANT ALL ON public.transaction_audit_logs TO service_role;
ALTER TABLE public.transaction_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner and hub members read audit" ON public.transaction_audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_hub_member(auth.uid(), user_id));
CREATE INDEX idx_tal_user_created ON public.transaction_audit_logs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_transactions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _act text; _row public.transactions; _src text;
BEGIN
  IF TG_OP = 'DELETE' THEN _row := OLD; _act := 'DELETE';
  ELSE _row := NEW;
    IF TG_OP = 'INSERT' THEN _act := 'INSERT';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Pago' THEN _act := 'PAY';
    ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'Pendente' THEN _act := 'UNPAY';
    ELSE _act := 'UPDATE';
      IF to_jsonb(OLD) = to_jsonb(NEW) THEN RETURN NEW; END IF;
    END IF;
  END IF;
  _src := CASE WHEN auth.uid() IS NULL THEN 'sistema' ELSE 'app' END;
  INSERT INTO public.transaction_audit_logs(user_id, actor_id, entity, entity_id, action, old_data, new_data, source)
  VALUES (_row.user_id, COALESCE(auth.uid(), _row.created_by_user_id, _row.user_id), 'transaction', _row.id, _act,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END, _src);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER trg_audit_transactions AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_transactions();

CREATE OR REPLACE FUNCTION public.audit_ai_pending()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _act text; _uid uuid; _id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN _act := 'AI_CREATE'; _uid := NEW.user_id; _id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN _act := 'AI_DELETE'; _uid := OLD.user_id; _id := OLD.id;
  ELSE
    _uid := NEW.user_id; _id := NEW.id;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      _act := CASE NEW.status WHEN 'approved' THEN 'AI_APPROVE' WHEN 'rejected' THEN 'AI_REJECT' ELSE 'AI_UPDATE' END;
    ELSE RETURN NEW; END IF;
  END IF;
  INSERT INTO public.transaction_audit_logs(user_id, actor_id, entity, entity_id, action, old_data, new_data, source)
  VALUES (_uid, COALESCE(auth.uid(), _uid), 'ai_pending', _id, _act,
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.source ELSE NEW.source END);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER trg_audit_ai_pending AFTER INSERT OR UPDATE OR DELETE ON public.ai_pending_transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_ai_pending();

CREATE OR REPLACE FUNCTION public.log_import_batch(_owner uuid, _count integer, _total numeric, _label text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _owner AND NOT public.is_hub_member_writer(auth.uid(), _owner)) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  INSERT INTO public.transaction_audit_logs(user_id, actor_id, entity, action, new_data, source)
  VALUES (_owner, auth.uid(), 'import', 'IMPORT',
    jsonb_build_object('description', COALESCE(_label,'Extrato importado'), 'count', _count, 'amount', _total), 'importacao');
END $$;
GRANT EXECUTE ON FUNCTION public.log_import_batch(uuid, integer, numeric, text) TO authenticated;