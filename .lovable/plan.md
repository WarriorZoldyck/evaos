# Restrição de funcionalidades por plano

## Diagnóstico atual

Hoje **não há nenhuma restrição real**. `useSubscription` só controla acesso geral (trial/ativo/bloqueado). O campo `features` em `subscription_plans` é apenas texto decorativo nos cards de preço, e `max_users` não é checado em lugar nenhum (o `create-hub-member` cria membros sem limite).

## Limites desta primeira versão

Aplicar como regra de plano (configurável via banco para facilitar mudanças futuras):

| Recurso | Individual | Família |
|---|---|---|
| Contas bancárias + cartões + carteiras + maquininhas (somados) | até **3** | ilimitado |
| Membros no EVA Hub | **0** (sem Hub) | até **3** inclusos, +R$ 29,90/usuário extra |
| Mensagens IA / mês (EVA WhatsApp + Chat in-app + Análises EVA) | cota mensal (definir valor — sugerido: 100) | cota maior (sugerido: 500) |
| Demais módulos (DRE, Precificação, Metas, etc.) | liberados em ambos | liberados em ambos |

Trial de 7 dias = libera tudo como Família (decisão do usuário).

## Arquitetura

### 1. Banco — fonte única de verdade dos limites

Migração para adicionar colunas estruturadas em `subscription_plans`:
- `max_accounts` (int, null = ilimitado)
- `max_hub_members` (int, default 0)
- `monthly_ai_messages` (int, null = ilimitado)
- `extra_user_price_cents` (int, default 0)

Atualizar os 2 planos existentes com esses valores. O array `features` (texto) continua só para exibição.

Nova tabela `ai_usage_counters`:
- `user_id`, `period_year_month` (ex: `2026-05`), `messages_used` (int)
- PK composta (user_id, period_year_month), RLS própria do user
- Incrementada via função `public.increment_ai_usage(_uid uuid)` (security definer) chamada pelas edge functions de IA.

### 2. Hook central de permissões

Criar `src/hooks/usePlanLimits.ts`:
- Lê `useSubscription` + conta atual de contas/membros/uso de IA
- Retorna helpers:
  - `canCreateAccount()` → boolean + motivo
  - `canCreateHubMember()` → boolean + motivo
  - `canUseAI()` → boolean + cota restante
  - `isTrialFullAccess` (true durante trial)
  - `effectivePlanSlug` ("familia" durante trial, senão o real)

### 3. Componente de bloqueio reutilizável

`src/components/subscription/UpgradeGate.tsx`:
- Modal/Card com título, motivo, botão "Fazer upgrade" → `/planos`
- Variante inline (substitui o conteúdo) e variante modal (intercepta ação)

### 4. Pontos de aplicação no frontend

- **Contas/Cartões/Carteiras/Maquininhas** (`Contas.tsx` e modais de criação): antes de abrir o modal de criação, checar `canCreateAccount()`. Se falhar, abrir `UpgradeGate` modal.
- **EVA Hub** (`AppSidebar.tsx`, rotas `/eva-hub/*`): se Individual e não impersonando, esconder item do menu e proteger rotas em `HubLayout` com `UpgradeGate` em tela cheia.
- **Cadastro de membro do Hub** (`HubMembros.tsx`): bloquear botão "Adicionar membro" quando atingir `max_hub_members`, com CTA "Comprar usuário extra" (placeholder por enquanto — fluxo de cobrança extra fica para depois).
- **Chat EVA / Análises EVA**: desabilitar input com mensagem "Cota de IA do mês esgotada — faça upgrade" quando `canUseAI()` for false.

### 5. Pontos de aplicação no backend (defesa em profundidade)

Frontend pode ser contornado, então também validar nas edge functions:

- `create-hub-member`: ler plano efetivo do owner, contar `workspace_members` ativos, recusar se exceder `max_hub_members`.
- `eva-chat`, `whatsapp-webhook`, função de análise EVA: ler `ai_usage_counters` do mês, recusar com 402-equivalente se cota esgotada, e chamar `increment_ai_usage` em cada interação bem-sucedida.
- (Opcional v2) trigger SQL em `bank_accounts` validando `max_accounts` — pode ficar para depois para evitar surpresas durante migração.

### 6. UI dos planos

Em `Planos.tsx` e `LandingPricing.tsx`, gerar a lista de bullets dinamicamente a partir das colunas estruturadas (ex: "Até 3 contas/cartões", "100 mensagens IA/mês"), mantendo `features` textual como complemento.

## Fora deste escopo (próximas iterações)

- Cobrança real de usuários extras (R$ 29,90) — apenas botão "Comprar usuário extra" stub.
- Sistema de recargas de créditos de IA — preparado pela tabela `ai_usage_counters`, mas a venda de pacotes fica para depois.
- Novos planos além de Individual/Família.

## Resumo das mudanças

- 1 migração: novas colunas em `subscription_plans` + `ai_usage_counters` + função `increment_ai_usage`.
- 1 update de dados nos 2 planos existentes.
- Novo hook `usePlanLimits` e componente `UpgradeGate`.
- Edits em: `Contas.tsx`, `AppSidebar.tsx`, `HubLayout.tsx`, `HubMembros.tsx`, `EvaChatPanel.tsx`, `AnalisesEva.tsx`, `Planos.tsx`, `LandingPricing.tsx`.
- Edits nas edge functions: `create-hub-member`, `eva-chat`, `whatsapp-webhook`, e a função de análise EVA.
