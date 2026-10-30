ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_weekdays_only boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_last_sent_date date;