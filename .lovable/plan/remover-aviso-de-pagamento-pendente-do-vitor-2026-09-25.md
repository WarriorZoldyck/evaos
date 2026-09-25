# Remover aviso de pagamento pendente do Vitor

## Objetivo
O Vitor (vitor_fernandes_rv@hotmail.com) está em dia, mas a assinatura dele está marcada como `past_due` com carência até 27/09/2026 — por isso ele vê o aviso "Pagamento pendente — 1 dia para regularizar antes do bloqueio". Vamos regularizar o registro dele.

## Estado atual (confirmado no banco)
- Assinatura `804c13b6-a722-43f6-828b-468b31f07084`: status `past_due`, `grace_until` 27/09/2026, próximo vencimento registrado como 20/05/2026, sem pagamento registrado.

## O que será feito
1. Atualizar a assinatura do Vitor para:
   - status `active`
   - limpar a carência (`grace_until` = null)
   - registrar o pagamento de hoje (`last_payment_at` = agora)
   - próximo vencimento em 20/10/2026 (mantendo o dia 20 como ciclo mensal dele)
2. Verificar que o aviso some e o acesso fica normal.

## Detalhes técnicos
- Única alteração de dados na tabela `subscriptions` (linha do Vitor apenas).
- Nenhuma mudança de código, cron ou de outras assinaturas.
