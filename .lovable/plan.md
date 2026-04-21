

# Integração Asaas — Assinaturas, Planos e Cupom BETA50

## Planos
| Plano | Preço/mês | Descrição |
|---|---|---|
| Individual | R$ 99,90 | 1 usuário |
| Família | R$ 139,90 | Até 3 usuários |
| Usuário Adicional | R$ 29,90 | Add-on por seat extra na Família |
| Cupom **BETA50** | -50% | Limite global de 20 usos (primeiros beta testers) |

Métodos de pagamento: **Cartão de crédito (recorrente), Pix e Boleto** — todos via Asaas.

## Banco de Dados (migração)

**Novas tabelas:**
- `subscription_plans` — catálogo dos planos (slug, nome, preço, max_seats, asaas_plan_id)
- `subscriptions` — assinatura ativa do usuário (user_id, plan_id, status, seats, asaas_customer_id, asaas_subscription_id, current_period_end, coupon_code)
- `subscription_seats` — usuários extras adicionados ao Plano Família (subscription_id, member_email, member_user_id)
- `coupons` — cupom global (code, discount_percent, max_uses, used_count, active)
- `coupon_redemptions` — histórico (coupon_id, user_id, subscription_id, redeemed_at)
- `asaas_webhook_events` — idempotência (event_id único, payload, processed_at)

**Função RPC atômica `redeem_coupon(_code)`** — usa `UPDATE ... WHERE used_count < max_uses RETURNING *` para evitar race conditions no limite de 20.

**Seed inicial:** 3 planos + cupom BETA50 (max_uses=20, discount=50).

**RLS:** Usuário lê apenas sua própria `subscription` e `subscription_seats`. Tabelas de catálogo (`subscription_plans`) são públicas para leitura. Webhook events sem acesso público.

**Coluna em `profiles`:** `subscription_required boolean default true` — marcamos os usuários atuais como `false` via UPDATE para não bloqueá-los.

## Edge Functions

| Função | verify_jwt | Responsabilidade |
|---|---|---|
| `asaas-create-subscription` | true | Cria customer + subscription no Asaas, valida cupom via RPC, retorna `invoiceUrl` (checkout hospedado completo: cartão/Pix/boleto) |
| `asaas-update-seats` | true | Adiciona/remove seats no Plano Família, recalcula valor (139,90 + extras × 29,90) |
| `asaas-cancel-subscription` | true | Cancela no Asaas e marca status local |
| `asaas-get-subscription` | true | Retorna status, próxima cobrança, link da fatura atual |
| `asaas-webhook` | false | Recebe eventos `PAYMENT_CONFIRMED/RECEIVED/OVERDUE/REFUNDED` e atualiza `subscriptions.status`. Valida via header `asaas-access-token` e gravação idempotente em `asaas_webhook_events` |

**Secret necessário:** `ASAAS_API_KEY` + `ASAAS_WEBHOOK_TOKEN` (gerado por nós e configurado no painel Asaas).

## Frontend

**Nova página `/planos`** (rota pública após login, mas obrigatória se `subscription_required=true && sem subscription ativa`):
- 3 cards (Individual / Família / Família + extras com stepper de seats)
- Campo de cupom com validação inline ("BETA50 — 50% off aplicado")
- Botão "Assinar" → chama `asaas-create-subscription` → redireciona para `invoiceUrl` do Asaas (checkout completo)

**Nova aba em `/configuracoes` — "Assinatura":**
- Plano atual, status, próxima cobrança, link da última fatura
- Botões: Trocar plano, Gerenciar seats (Família), Cancelar
- Lista de seats com email do membro

**Guard de rota** em `AppLayout`: se `subscription_required=true` e sem assinatura `active/trial`, redireciona para `/planos`. Usuários atuais (marcados como `subscription_required=false` na migração) passam livre.

## Fluxo do Cupom BETA50
```text
User digita "BETA50" → frontend chama asaas-create-subscription
  ↓
Edge function chama RPC redeem_coupon('BETA50')
  ↓
RPC: UPDATE coupons SET used_count = used_count + 1
     WHERE code='BETA50' AND used_count < 20 RETURNING *
  ↓
Se retornou linha → cria subscription no Asaas com discount=50%
Se vazio → retorna erro "Cupom esgotado"
```

## Segurança da Chave Asaas
- `ASAAS_API_KEY` armazenada como **Supabase Secret** (criptografada, server-side)
- **Nunca** exposta ao frontend
- Todas as chamadas à API Asaas acontecem dentro das Edge Functions
- Cliente vê apenas: catálogo de planos, status da própria assinatura, e o `invoiceUrl` de checkout (URL pública do Asaas)

## Ordem de Execução (após aprovação)
1. Pedir secrets `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`
2. Criar migração (tabelas + RPC + seed + coluna profiles)
3. Criar 5 edge functions
4. Criar página `/planos` + aba Assinatura em Configurações
5. Adicionar guard de rota
6. Atualizar memória do projeto (`mem://features/subscriptions`)
7. Fornecer URL do webhook para você colar no painel Asaas

