## Objetivo
O usuário `guilherme@resolvsolucoes.com.br` (id `163d8be1-…a62ae`) está hoje com assinatura **Individual / canceled** e trial expirado em 18/05/2026. Por isso o EVA Hub mostra a tela "exclusivo do plano Família" e ele não consegue nem aceitar convites.

## Ação proposta
Atualizar a linha existente em `public.subscriptions` desse usuário via script (service role / migration de dados) para conceder acesso total:

- `plan_id` → plano **Família** (`9ff71c27-476d-4884-86bb-9303c821e14f`)
- `status` → `active`
- `is_beta` → `true` (cortesia, mesmo padrão usado em concessões internas)
- `billing_cycle` → `yearly`
- `current_period_end` → `now() + interval '10 years'` (acesso vitalício prático)
- `canceled_at` → `NULL`, `grace_until` → `NULL`
- `coupon_code` → `'CORTESIA_EVA'`, `discount_percent` → `100`
- Mantém `asaas_subscription_id`/cobrança fora (sem gerar invoice)

Com isso `has_active_subscription` retorna true, `usePlanLimits` carrega `FAMILIA`/`max_hub_members=3`, libera EVA Hub, aceitar convites, IA, contas ilimitadas etc.

## Por que não código de UI
O bloqueio é correto pela regra atual (plano Individual sem hub). A liberação solicitada é pontual para este usuário — feita só em dados, sem alterar a lógica de gate.

## Arquivos afetados
- Nenhum arquivo de código.
- 1 migration de dados (`UPDATE public.subscriptions …`) aplicada via ferramenta de migração.

## Confirmar antes de aplicar
1. Confirma que é para liberar **vitalício/cortesia** (10 anos) e não apenas reativar trial?
2. Aplico a mesma cortesia para `renatobruggemann@yahoo.com` também? (ele apareceu em mensagens anteriores; hoje não tem linha em `subscriptions`.)
