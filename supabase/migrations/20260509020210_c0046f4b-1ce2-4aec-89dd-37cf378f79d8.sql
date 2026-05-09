
UPDATE public.subscription_plans
  SET features = '["Até 3 contas/cartões/carteiras/maquininhas","100 mensagens da EVA por mês","Dashboard, DRE e Precificação completos","EVA WhatsApp","Suporte por email"]'::jsonb
  WHERE slug = 'individual';

UPDATE public.subscription_plans
  SET features = '["Tudo do Individual","Contas, cartões e maquininhas ilimitados","500 mensagens da EVA por mês","EVA Hub com até 3 usuários","Usuários extras por R$ 29,90/mês","Relatórios consolidados multi-empresa"]'::jsonb
  WHERE slug = 'familia';
