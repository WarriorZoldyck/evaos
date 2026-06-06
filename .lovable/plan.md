# Plano: Belvo (nova) + Itaú (passo-a-passo) + manter Pluggy

## Visão geral

Três integrações bancárias na tela `/integracoes`:

| Integração | Status | Quem usa |
|---|---|---|
| **Asaas** | já funciona | quem tem conta Asaas |
| **Pluggy** | mantém como está, inativo (sem subscription) | futuro |
| **Itaú API direta** | mantém botão, MAS abre um **guia mastigado** de como o usuário gera `.crt`+`.key` e cola `client_id`/`client_secret`. Sem prometer sync até ele subir os arquivos. | PJ Itaú com pacote API contratado |
| **Belvo (novo)** | **foco deste plano** — Open Finance regulado, funciona pra PF e PJ, autenticação simples por `secret_id:secret_password` (Basic Auth) | qualquer banco BR suportado pela Belvo |

## Por que Belvo resolve o problema

- API REST pura, autenticação `Basic base64(secret_id:secret_password)` — igual ao padrão do Asaas, sem mTLS, sem certificado.
- **Connect Widget hospedado pela Belvo** faz o login do usuário no banco dele (Itaú, Bradesco, BB, Nubank, Santander, Caixa, Inter…). A gente só gera um `access_token` no backend e abre o widget no frontend.
- Cobre PF e PJ.
- Sandbox grátis pra desenvolver/testar.
- Produção exige certificação (reunião + checklist), mas o código fica pronto.

## Fluxo Belvo (alto nível)

```text
1. Admin do EVA cadastra BELVO_SECRET_ID + BELVO_SECRET_PASSWORD (1 vez, secrets globais)
2. Usuário clica "Conectar via Belvo" na tela Integrações
   └─> edge function `belvo-connect-token` gera widget access_token
   └─> abre Connect Widget (script da Belvo) no modal
   └─> usuário escolhe banco, faz login, autoriza
   └─> widget retorna { link: "<link_id>", institution: "itau_br_retail" }
3. Frontend manda link_id pra `belvo-connect-account`
   └─> salva em `belvo_integrations` (user_id, link_id, institution, bank_account_id, company_id)
   └─> dispara primeira sync
4. `belvo-sync` busca:
   - GET /api/accounts/?link={id}        → saldo atual
   - GET /api/transactions/?link={id}&page_size=500 → últimos 90 dias
   └─> grava em `asaas_sync_items` (tabela já existe, reaproveitamos com provider='belvo')
   └─> tela de Conciliação Bancária já lista (provider novo: "belvo")
5. Webhook opcional (POST /belvo-webhook) recebe `historical_update` da Belvo e re-sincroniza
```

## Mudanças no app

### Backend (Supabase)

**Migration nova** — tabela `belvo_integrations`:
- `id`, `user_id`, `company_id`, `bank_account_id`
- `link_id` (uuid retornado pela Belvo)
- `institution` (ex.: `itau_br_retail`, `bb_br_retail`)
- `institution_display_name`, `environment` (`sandbox`|`production`)
- `last_sync_at`, `sync_status`, `last_error`, `initial_balance_synced`
- RLS: usuário só vê os próprios + GRANTs padrão (anon não, authenticated sim, service_role all)
- Estender `asaas_sync_items.payload` já é jsonb — só passamos a usar `integration_id` apontando pra belvo_integrations via convenção (sem FK rígida, igual hoje pra asaas/itau/pluggy).

**Secrets novos** (3):
- `BELVO_SECRET_ID`
- `BELVO_SECRET_PASSWORD`
- `BELVO_ENV` (`sandbox` ou `production`)

**Edge Functions novas** (`verify_jwt = false`, validação JWT em código):
- `belvo-connect-token` — POST → gera widget access_token via `POST /api/token/`
- `belvo-connect-account` — POST `{ link_id, institution, bank_account_id?, account_name?, company_id? }` → cria registro + cria/liga `bank_account`
- `belvo-sync` — POST `{ integration_id? }` → lista accounts + transactions, popula `asaas_sync_items`
- `belvo-disconnect-account` — DELETE link na Belvo + apaga registro
- `belvo-webhook` (público, `verify_jwt=false`) — recebe `historical_update` / `new_accounts` e dispara sync

**Helper compartilhado** `supabase/functions/_shared/belvo.ts` com `belvoFetch(path, init)` aplicando Basic Auth e base URL conforme env.

### Frontend

- **Novo hook** `src/hooks/useBelvoIntegration.ts` (espelho do `useItauIntegration` — list/connect/sync/disconnect).
- **Novo modal** `src/components/integracoes/BelvoConnectModal.tsx`:
  - botão "Conectar conta bancária via Belvo"
  - carrega o script `https://cdn.belvo.io/belvo-widget-1-stable.js`
  - chama `belvo-connect-token` → instancia widget → callback `onSuccess(link, institution)` → chama `belvo-connect-account`
  - seleção de "Nova conta" ou "Vincular a conta existente" + escolha de Pessoal/Empresa (CompanyContext)
- **Card novo** em `src/pages/Integracoes.tsx` (Belvo — Open Finance regulado, PF e PJ, sem certificado).
- **ConciliacaoBancaria.tsx**: adicionar `belvoH = useBelvoIntegration()` no `integrations` unificado, com label `"Belvo · {bank} · {conta}"` e badge `Belvo`.
- **ItauConnectModal.tsx**: reformular para virar um **guia mastigado** com tabs:
  - **Passo 1 — Portal Itaú Developers**: cadastrar app, contratar pacote Cash Management/Open Finance B2B (PJ).
  - **Passo 2 — Gerar par de chaves** (bloco de código copiável):
    ```bash
    openssl genrsa -out itau.key 2048
    openssl req -new -key itau.key -out itau.csr \
      -subj "/C=BR/ST=SP/L=SaoPaulo/O=SUA_EMPRESA/OU=TI/CN=api.itau"
    ```
    Subir o `.csr` no portal Itaú → baixar o `.crt` assinado.
  - **Passo 3 — Anexar**: campos pra colar `client_id`, `client_secret`, `.crt`, `.key`, agência/conta/dígito.
  - **Aviso destacado**: "Disponível só pra PJ com pacote API ativo. PF: use Belvo (botão acima) ou importação OFX/PDF."

### Pluggy
- **Sem mudanças.** Card e código permanecem como estão hoje.

## Detalhes técnicos importantes

- **Auth Belvo**: header `Authorization: Basic ${btoa(secretId+":"+secretPassword)}` em todas as chamadas.
- **Base URL**: `https://sandbox.belvo.com` ou `https://api.belvo.com` conforme `BELVO_ENV`.
- **Widget access_token**: gerado server-side via `POST /api/token/` com body `{ id, password, scopes: "read_institutions,write_links,read_consents,write_consents,write_consent_callback" }`. Token vai pro frontend, é de uso único pro widget.
- **Paginação** em `/api/transactions/`: usar `page_size=500` + seguir `next` até esgotar (limitar a 90 dias na 1ª sync).
- **Idempotência**: usar `transaction.id` da Belvo como `asaas_id` em `asaas_sync_items` com `source_type='belvo_transaction'`, UNIQUE garante dedupe.
- **Webhook**: configurar URL `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/belvo-webhook` no portal Belvo. Valida `Webhook-Signature` (HMAC-SHA256 com secret próprio).

## Ordem de execução

1. Migration `belvo_integrations` + GRANTs + RLS.
2. Pedir os 3 secrets Belvo via tool `add_secret`.
3. Helper `_shared/belvo.ts` + 5 edge functions (`belvo-*`).
4. Hook `useBelvoIntegration` + modal Belvo + card na página Integrações.
5. Conciliação Bancária — somar Belvo no provider unificado.
6. Reescrita do `ItauConnectModal` como guia passo-a-passo.
7. Documentar no `Docs.tsx` (opcional) o fluxo Belvo.

## O que **não** vou mexer

- Pluggy (código, modal, tabela, edge functions).
- Asaas.
- Itaú edge functions (`itau-connect-account`, `itau-sync`, `itau-disconnect-account`) — ficam como estão pra quando o usuário subir o certificado.

## Pergunta única antes de implementar

Você já tem conta criada na **Belvo** (mesmo que sandbox)? Se sim, preciso que você gere o `secretId` e `secretPassword` no dashboard deles (Settings → API Keys) — vou te pedir via o formulário seguro de secrets assim que aprovar o plano. Se ainda não tem conta, te mando o link de cadastro e a gente segue o resto enquanto isso.
