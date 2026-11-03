DO $migration$
DECLARE old_id uuid := 'd25498a8-b729-4fbf-8a83-8cabc64005c3'; new_id uuid := '52969df3-6389-4872-85be-f465b4534b7a';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=old_id AND lower(email)='erikafmatos@yahoo.com.br') OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=new_id AND lower(email)='erikalavrasmed@gmail.com') THEN
    RAISE EXCEPTION 'Account identity verification failed';
  END IF;
  PERFORM id FROM public.profiles WHERE id IN (old_id,new_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=new_id AND right(regexp_replace(whatsapp_number,'[^0-9]','','g'),10)='5998418248') THEN
    RAISE EXCEPTION 'New account WhatsApp verification failed';
  END IF;
  UPDATE public.profiles SET whatsapp_number=NULL, updated_at=now() WHERE id=old_id AND right(regexp_replace(whatsapp_number,'[^0-9]','','g'),10)='5998418248';
END;
$migration$;