# Alertas de vencimento no WhatsApp

## O que verifiquei (últimos 7 dias)
- Todos os 5 agendamentos estão ativos e não tiveram nenhuma falha (lembretes de hora em hora, assinaturas, resumo semanal de metas, limpeza do histórico).
- O envio de lembretes rodou a cada hora hoje e respondeu normalmente. Nenhum erro de servidor nos últimos 3 dias.
- O problema real: dos 15 usuários com WhatsApp, só 1 tem os lembretes ativados. Os outros 14 nunca recebem aviso. Por isso parece que "não funciona", mesmo sem erro.
- Os e-mails de erro do Supabase provavelmente são de antes da correção anterior. Hoje não há falhas registradas.

## O que vou fazer
1. Ligar os lembretes para todos os usuários que têm WhatsApp cadastrado, às 08:00, em dias úteis, avisando 0, 1 e 3 dias antes. Quem quiser pode desligar nas Configurações.
2. Fazer os lembretes já virem ligados para quem cadastrar o WhatsApp no futuro.
3. Rodar um teste sem envio real para conferir quem receberia o aviso amanhã.
4. Vigiar as próximas rodadas e registrar no histórico qualquer falha de envio, para não depender dos e-mails.

## Detalhes técnicos
- Atualizar `profiles` (`whatsapp_reminders_enabled = true`, com os valores padrão) onde `whatsapp_number` não é nulo e os lembretes nunca foram configurados.
- Colocar o valor padrão da coluna e o padrão do formulário de Configurações como ligado.
- Chamar `cron-whatsapp-reminders` em modo de teste (`dry_run`) para validar.
