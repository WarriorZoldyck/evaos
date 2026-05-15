## Objetivo
1. Cadastrar cupons MARISTELA50 e DENISE50 (50% off, uso único, qualquer plano/ciclo).
2. Permitir troca de plano estilo Netflix: upgrade/downgrade para assinaturas ativas e reativação para canceladas/expiradas.

## 1) Cupons (migration)
Inserir em `subscription_coupons`:
- `MARISTELA50` — percent 50, max_uses 1, applies_to_cycle=both, applies_to_plan_slug=NULL, is_active=true.
- `DENISE50` — idem.

Backend `asaas-create-subscription` já valida cupom (expiração, uso, plano, ciclo, usuário) — sem mudanças.

## 2) Troca de plano (Netflix-style)

### Comportamento
- **Sem assinatura / cancelada / expirada** → botão "Assinar" abre checkout normal (cria nova assinatura, reaproveitando customer Asaas).
- **Trial ou ativa, mesmo plano** → botão desabilitado "Plano atual".
- **Trial ou ativa, outro plano** → botão "Fazer upgrade" ou "Fazer downgrade" (compara `price_cents`). Confirmação em modal: ajuste só vale a partir do próximo vencimento, sem cobrança proporcional imediata.
- **Past_due** → mantém comportamento atual (banner para regularizar).

### Reativação de canceladas
Conforme decisão do usuário: **reaproveitar a assinatura Asaas existente** (não cria nova) e **NÃO concede novo trial** (`trial_ends_at = null`, `status = 'active'`, `next_due_date = hoje + ciclo`). Evita abuso de trial.

### Mudanças

**Frontend `src/pages/Planos.tsx`:**
- Remover bloqueio `toast.info("Você já possui...")`.
- Computar estado por plano: `current` | `upgrade` | `downgrade` | `subscribe` | `reactivate`.
- Renderizar botão correspondente. Para upgrade/downgrade abrir confirm dialog simples (sem form de CPF/cartão).
- Para `subscribe` (sem sub) e `reactivate` (canceled/expired) abrir o modal de checkout existente; backend decide se cria nova ou reativa.

**Frontend `src/pages/MinhaAssinatura.tsx` + `SubscriptionGuard.tsx`:**
- Para status `canceled`/`expired` mostrar CTA "Reativar assinatura" → `/planos`.

**Backend — nova edge function `supabase/functions/asaas-change-plan/index.ts`:**
- Valida JWT.
- Busca assinatura ativa (`trialing` ou `active`) do usuário.
- Recebe `plan_slug` e opcional `billing_cycle`.
- Calcula novo `value` (aplica desconto vigente se houver).
- `POST /subscriptions/{asaas_id}` no Asaas atualizando `value` (e `cycle` se mudou). Mantém `nextDueDate`.
- Atualiza `subscriptions.plan_id` e `billing_cycle` no DB. Não mexe em `trial_ends_at`.
- Retorna sucesso; cobrança ajustada vale do próximo vencimento.

**Backend — ajustar `asaas-create-subscription`:**
- Se existir assinatura `canceled`/`expired` do usuário com `asaas_subscription_id`:
  - Reativar via `POST /subscriptions/{id}` no Asaas (`status: ACTIVE`, novo `nextDueDate`, novo `value`/`cycle`/`billingType` se mudou).
  - UPDATE da row existente: `status='active'`, `trial_ends_at=null`, `canceled_at=null`, `next_due_date`, `plan_id`, `billing_cycle`, `billing_type`, `coupon_code`, etc.
  - Se Asaas retornar erro de assinatura inexistente, criar nova como fallback.
- Bloqueio existente de "já tem assinatura ativa" permanece para `trialing/active/past_due`.

**`supabase/config.toml`:** registrar `asaas-change-plan` com `verify_jwt = false` (validação manual).

## Migrations necessárias
1. INSERT dos 2 cupons em `subscription_coupons`.

## Arquivos
- novo: `supabase/functions/asaas-change-plan/index.ts`
- editar: `supabase/functions/asaas-create-subscription/index.ts` (lógica de reativação)
- editar: `supabase/config.toml`
- editar: `src/pages/Planos.tsx` (estados e botões por plano)
- editar: `src/pages/MinhaAssinatura.tsx` (CTA reativar)
- editar: `src/components/subscription/SubscriptionGuard.tsx` (banner para canceled/expired)
- migration: inserir cupons
