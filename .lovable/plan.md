# Integração Asaas — Cobrança Recorrente

## Planos definidos

| Plano | Preço normal | Preço beta (50% off) | Inclui |
|---|---|---|---|
| **Individual** | R$ 99,90/mês | R$ 49,95/mês | 1 usuário |
| **Família** | R$ 139,90/mês | R$ 69,95/mês | 3 usuários |
| **Usuário extra** | R$ 29,90/mês | R$ 14,95/mês | adicional ao Família |

- **Trial**: 7 dias grátis (sem cartão obrigatório? — ver decisão técnica abaixo)
- **Métodos**: Cartão de crédito recorrente, PIX e Boleto
- **Bloqueio**: 3 dias de graça após vencimento → hard block (redirect para `/planos`)
- **Beta**: primeiros 20 assinantes recebem 50% off (cupom automático/perpétuo)

## O que será criado

### 1. Banco de dados (migration)

- `subscription_plans` — catálogo de planos (slug, nome, preço cents, max_users, features)
- `subscriptions` — assinatura ativa do usuário (plan_id, status, asaas_subscription_id, trial_ends_at, current_period_end, grace_until, beta_discount)
- `asaas_customers` — vincula `user_id` ↔ `asaas_customer_id`
- `asaas_webhook_events` — log idempotente de eventos
- View `v_user_subscription_status` para gating rápido
- Função `has_active_subscription(uid)` SECURITY DEFINER
- RLS: usuário lê só sua própria assinatura; webhooks usam service role

### 2. Edge Functions

- `asaas-create-customer` — cria cliente no Asaas (CPF/CNPJ obrigatório) na 1ª contratação
- `asaas-create-subscription` — cria assinatura recorrente (trial = `nextDueDate` em D+7), retorna URL de checkout para o método escolhido
- `asaas-webhook` — recebe eventos `PAYMENT_*` e `SUBSCRIPTION_*`, atualiza status/grace_until, idempotente via token + event id
- `asaas-cancel-subscription` — cancela ao final do período
- `asaas-billing-portal` — gera link/dados para gerenciar pagamento (trocar cartão)

### 3. Frontend

- **`src/pages/Planos.tsx`** — nova página de seleção e checkout (4 cards, badge "Beta 50% off" se elegível, contador "X/20 vagas")
- **`src/pages/MinhaAssinatura.tsx`** — em Configurações: status, próximo vencimento, trocar plano, cancelar, link Asaas
- **Modal de checkout**: pede CPF/CNPJ + escolha método (Cartão/PIX/Boleto) → chama edge function → redirect Asaas
- **`src/hooks/useSubscription.ts`** — busca status atual + helpers `isActive`, `isInTrial`, `isInGrace`, `isBlocked`, `canUseFeature(featureKey)`
- **`src/components/SubscriptionGuard.tsx`** — wrapper de rota: bloqueado vê tela "Assinatura expirada" com CTA pra `/planos`. Em grace mostra banner amarelo no topo
- **Atualizar `LandingPricing.tsx`** — refletir Individual/Família com preços reais e badge beta
- **Sidebar**: item "Minha Assinatura"

### 4. Secrets necessários

- `ASAAS_API_KEY` — token de produção do Asaas (Configurações → Integrações → API)
- `ASAAS_WEBHOOK_TOKEN` — string que você define e cola no painel Asaas como autenticação de webhook

## Decisões técnicas a confirmar

1. **Trial sem cartão?** Recomendo **exigir cartão/método já no signup do trial** (Asaas só agenda a 1ª cobrança em D+7). Isso reduz drasticamente quem some no fim do trial. Se preferir trial 100% sem método, eu monto sem chamar o Asaas durante o trial e crio a subscription só no D+7.
2. **Beta 50%**: vou implementar contando assinantes ativos com `is_beta=true`. Quando atingir 20, novos não recebem mais. Desconto é **perpétuo** (vitalício enquanto o assinante mantiver o plano).
3. **Família — usuários extras**: vou criar a estrutura, mas a cobrança do "extra" será adicionada via add-on numa próxima iteração (Asaas trata como outra assinatura ou ajuste de valor da existente). Nesta entrega, apenas o limite de 3 usuários é respeitado.

## Fluxo do usuário

```
Landing → /auth → /dashboard (sem assinatura)
                        ↓
                  Banner "Inicie seu trial"
                        ↓
                  /planos → escolhe plano
                        ↓
              Modal: CPF/CNPJ + método
                        ↓
       Edge: cria customer + subscription Asaas
                        ↓
        Trial ativo 7 dias → cobrança automática
                        ↓
            Webhook atualiza status → continua usando
                        ↓
        Falha pagamento → grace 3 dias → hard block
```

## Ordem de execução

1. Migration (tabelas + RLS + função + seed dos planos)
2. Adicionar secret `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`
3. Edge functions
4. Hook `useSubscription` + `SubscriptionGuard`
5. Página `/planos` + modal checkout
6. Página `/configuracoes/assinatura`
7. Atualizar `LandingPricing` com preços reais
8. Aplicar `SubscriptionGuard` nas rotas do dashboard
9. Configurar webhook no painel Asaas (te passo a URL no final)

Confirma esses 3 pontos da seção "Decisões técnicas" e eu executo na sequência.
