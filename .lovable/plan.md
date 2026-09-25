# Reativar a assinatura da Sabrina

## Objetivo
A Sabrina (sabrinadomingues04@gmail.com) regularizou o pagamento. Hoje a assinatura dela está marcada como `expired`, o que bloqueia o acesso ao sistema. Vamos reativá-la.

## Estado atual (confirmado no banco)
- Assinatura `3e2a3e38-0692-40f5-a973-c86fc25a20dc`: status `expired`, carência encerrada em 21/09/2026, próximo vencimento registrado como 16/06/2026, sem pagamento registrado.

## O que será feito
1. Atualizar a assinatura da Sabrina para:
   - status `active`
   - remover a tolerância de bloqueio (`grace_until` limpa)
   - registrar o pagamento de hoje (`last_payment_at` = agora)
   - próximo vencimento em 16/10/2026 (mantendo o dia 16 como ciclo mensal dela)
2. Verificar que o acesso dela volta imediatamente (a regra de acesso libera quem está `active`).

## Detalhes técnicos
- Única alteração de dados na tabela `subscriptions` (linha da Sabrina apenas).
- Nenhuma mudança de código, cron ou de outras assinaturas.
