-- Adiciona configurações de lembretes no perfil do usuário
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_reminders_days integer[] DEFAULT '{1, 3}';
