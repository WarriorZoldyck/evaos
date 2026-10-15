-- Configurações de horário/agendamento dos lembretes de WhatsApp
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS whatsapp_reminders_time text DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS whatsapp_reminders_weekdays_only boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_last_sent_date text;

-- O disparo horário é feito pelo GitHub Actions (.github/workflows/whatsapp-reminders-cron.yml),
-- autenticado pelo secret BROADCAST_ADMIN_KEY. Nenhum segredo é armazenado aqui.
