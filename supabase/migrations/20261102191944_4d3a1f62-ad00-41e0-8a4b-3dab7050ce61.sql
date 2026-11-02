ALTER TABLE public.profiles ALTER COLUMN whatsapp_reminders_enabled SET DEFAULT true;
UPDATE public.profiles SET whatsapp_reminders_enabled = true,
  whatsapp_reminders_days = COALESCE(whatsapp_reminders_days, ARRAY[0,1,3]),
  whatsapp_reminders_time = COALESCE(whatsapp_reminders_time, '08:00'),
  whatsapp_reminders_weekdays_only = true,
  whatsapp_reminders_last_sent_date = COALESCE(whatsapp_reminders_last_sent_date, (now() AT TIME ZONE 'America/Sao_Paulo')::date)
WHERE whatsapp_number IS NOT NULL AND COALESCE(whatsapp_reminders_enabled, false) = false;