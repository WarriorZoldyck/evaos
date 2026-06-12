## Objetivo

Finalizar a integração Belvo Open Finance no app, no modelo **credenciais EVA gerenciadas** (cliente não cola token), ambiente **sandbox** primeiro, importando **contas + saldo, transações, cartões de crédito e itens recorrentes/agendados**. A tabela `belvo_integrations` já existe — falta toda a camada de edge functions e UI.

## Como o usuário vai usar

1. Em **Integrações → Open Finance (Belvo)**, clica em "Conectar banco".
2. Abre o **Belvo Connect Widget** (script oficial) já autenticado com um `access_token` curto gerado no nosso backend usando nossas credenciais.
3. Escolhe o banco e faz login no fluxo Open Finance da Belvo.
4. No sucesso, recebemos `link_id` via callback, vinculamos a uma conta bancária (existente ou nova) e disparamos sync inicial.
5. Transações importadas vão para **Análises EVA** (ai_pending_transactions) para revisão, igual Pluggy/Itaú. Cartões viram `credit_cards` + lançamentos. Recorrentes viram sugestões em `recurring_transactions`.
6. Botão **Sincronizar agora** + sync automático diário via cron.

## Arquitetura

```text
[UI Integrações] ──► belvo-connect-token ──► Belvo /api/token (widget_access)
       │                                          │
       │  abre widget ◄──────────────────────────┘
       │
       ├──► belvo-register-link (link_id, institution)
       │         └─► insere belvo_integrations + cria/vincula bank_account
       │
       ├──► belvo-sync (manual ou cron)
       │         ├─ /accounts        → saldo + metadata
       │         ├─ /transactions    → ai_pending_transactions
       │         ├─ /owners + /institutions → enriquecimento
       │         └─ /recurring-expenses + /incomes → recurring_transactions (sugestão)
       │
       ├──► belvo-disconnect-account ──► DELETE /links/{id} + soft delete
       │
       └──► belvo-webhook (opcional fase 2: historical_update, new_transactions)
```

## Mudanças no banco

Migration única adicionando ao que falta em `belvo_integrations` e tabelas auxiliares:

- `belvo_integrations`: adicionar `credit_card_id uuid` (vínculo p/ cartão), `last_link_status text`, `auto_sync_enabled boolean default true`, `external_account_id text` (id da conta dentro da Belvo).
- Nova tabela `belvo_sync_items` (log de execução: account, started_at, finished_at, status, counts, error) — mesmo padrão do `asaas_sync_items`. Com GRANTs + RLS owner/hub.
- Constraint: `bank_account_id` **ou** `credit_card_id` deve estar preenchido (não os dois).
- Função/cron `pg_cron` chamando edge `belvo-sync-all` 1x/dia (madrugada), respeitando `auto_sync_enabled`.

## Edge functions (Deno)

Todas com CORS, validação Zod do body, JWT validado em código (já é padrão do projeto), `service_role` para escrita, secrets `BELVO_SECRET_ID` / `BELVO_SECRET_PASSWORD` / `BELVO_ENV=sandbox`.

1. **belvo-connect-token** — gera `access_token` widget (`scopes: read_institutions,write_links,read_consents`), retorna `{ access_token, env }`.
2. **belvo-register-link** — recebe `{ link_id, institution, bank_account_id?, credit_card_id?, create_new_account? }`. Faz `POST /accounts` (refresh inicial), grava `belvo_integrations`, cria `bank_account`/`credit_card` quando solicitado, retorna integration.
3. **belvo-sync** — recebe `{ integration_id }`. Busca `/accounts`, `/transactions?date_from=last_sync-2d`, faz dedupe por `external_id` (hash idempotente), insere em `ai_pending_transactions` (mesmo fingerprint SHA-256 já usado pelo Pluggy). Para cartão: agrupa por fatura. Para recorrência: chama `/recurring-expenses` + `/incomes` e popula sugestões.
4. **belvo-sync-all** — cron, itera integrações ativas, invoca `belvo-sync` por id, escreve `belvo_sync_items`.
5. **belvo-disconnect-account** — chama `DELETE /links/{id}`, marca `sync_status='disconnected'`, mantém histórico.
6. **belvo-webhook** (stub para fase 2; rota pública com assinatura HMAC).

## UI

Tudo em `src/pages/Integracoes.tsx` (já existe a seção Pluggy/Itaú — adicionar **card Belvo Open Finance** com mesmo padrão visual glassmorphism cyan).

- `BelvoConnectModal.tsx` — carrega script `https://cdn.belvo.io/belvo-widget-1-stable.js`, recebe token da edge, lida com callbacks `onSuccess(link, institution)`, `onExit(data)`, `onEvent(data)`.
- `BelvoIntegrationsList.tsx` — lista vínculos ativos com institution, conta vinculada, último sync, badge de status, botões **Sincronizar / Desconectar / Auto-sync toggle**.
- Após sucesso do widget, modal de mapeamento: "Vincular a uma conta existente" (select de `bank_accounts`/`credit_cards`) ou "Criar nova conta automaticamente".
- Toasts e estados de erro padronizados; loading com skeleton.

## Secrets necessários (sandbox)

`BELVO_SECRET_ID`, `BELVO_SECRET_PASSWORD`, `BELVO_ENV` (default `sandbox`). Vou pedir via tool de secrets ao entrar em build mode — você cria na Belvo em dashboard → "Generate secret key".

## Segurança

- RLS já existente em `belvo_integrations` (owner + hub writer) será replicada em `belvo_sync_items`.
- Trigger de validação: `bank_account_id` xor `credit_card_id` preenchido.
- `link_id` é o único token persistido (não armazenamos credenciais bancárias do usuário — Belvo gerencia).
- Dedupe de transações via SHA-256 (account_id + external_id + amount + date) reaproveitando lógica de `ai_pending_transactions`.

## Fora de escopo agora (anotado p/ fase 2)

- Ambiente production (toggle só será adicionado quando você liberar a conta paga Belvo).
- Webhooks (criamos o stub, mas processamento completo de `historical_update` fica para fase 2).
- Pagamentos via Open Finance (Payment Initiation) — Belvo cobra à parte.
