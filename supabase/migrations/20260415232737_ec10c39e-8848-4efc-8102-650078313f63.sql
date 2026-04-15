-- Make whatsapp-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'whatsapp-attachments';

-- Add UPDATE policy for whatsapp-attachments storage objects
CREATE POLICY "Users can update their own whatsapp attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-attachments' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'whatsapp-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix mutable search_path on get_account_balance
CREATE OR REPLACE FUNCTION public.get_account_balance(account_id_param uuid)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
    total_balance numeric;
BEGIN
    SELECT
        a.initial_balance + COALESCE(SUM(
            CASE
                WHEN t.type = 'receita' THEN t.amount
                ELSE -t.amount
            END
        ), 0)
    INTO total_balance
    FROM public.bank_accounts a
    LEFT JOIN public.transactions t ON a.id = t.bank_account_id AND t.status = 'Pago'
    WHERE a.id = account_id_param
    GROUP BY a.initial_balance;

    RETURN total_balance;
END;
$function$;

-- Fix mutable search_path on handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$function$;

-- Fix mutable search_path on get_public_tables
CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE plpgsql
SET search_path = public, information_schema
AS $function$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
END;
$function$;

-- Fix mutable search_path on list_tables
CREATE OR REPLACE FUNCTION public.list_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
SET search_path = public, information_schema
AS $function$
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE';
$function$;