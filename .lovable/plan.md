Retomando a implementação da **Conciliação Bancária com Asaas** (plano já aprovado, migration e secret `ASAAS_KEY_ENCRYPTION_SECRET` já configurados).

## Próximos passos (execução direta)

1. **Edge function `asaas-connect-account`**
   - Recebe `api_key`, `mode` (`new_account` | `link_existing`), `bank_account_id?`, `account_name?`, `company_id?`.
   - Valida a key chamando `GET /v3/finance/balance` no Asaas.
   - Criptografa a key com AES-GCM usando `ASAAS_KEY_ENCRYPTION_SECRET`.
   - Se `new_account`: cria `bank_accounts` com `initial_balance` = saldo Asaas.
   - Insere `asaas_integrations`.

2. **Edge function `asaas-sync`**
   - Lê integração do usuário, descriptografa a key.
   - Busca `/v3/financialTransactions` (últimos 90 dias) e `/v3/payments?status=RECEIVED,CONFIRMED`.
   - Upsert em `asaas_sync_items` (idempotente por `asaas_id` + `source_type`).
   - Roda matcher: para cada item `pending`, busca em `transactions` da `bank_account_id` por `amount` exato + janela ±3 dias. Match único → marca `matched`. Vários → fica `pending` com sugestões no payload.
   - Atualiza `last_sync_at`.

3. **Edge function `asaas-disconnect-account`**
   - Apaga `asaas_integrations` (cascata limpa `asaas_sync_items`). Mantém a `bank_accounts` intacta.

4. **Hook `useAsaasIntegration`** — lista integrações, expõe `connect`, `sync`, `disconnect`.

5. **Página `/conciliacao-bancaria`**
   - Header: seletor de conta (apenas contas com integração), período, botão "Sincronizar".
   - Cards de saldo: Asaas vs Sistema vs Diferença.
   - Tabs: "Pendentes" / "Conciliados" / "Ignorados".
   - Tabela lado a lado: item Asaas → ação (confirmar match sugerido / escolher outro / criar lançamento / ignorar).
   - Modal "Escolher lançamento" com busca por valor e data próximos.
   - Ao confirmar match: `update transactions set is_reconciled = true` e `update asaas_sync_items set match_status = 'matched'`.

6. **Card Asaas em `/integracoes`**
   - Quando não conectado: badge "Conectar" + abre modal pedindo API Key + escolha (criar nova conta / vincular existente).
   - Quando conectado: badge "Ativo", última sync, botões "Sincronizar" e "Desconectar".

7. **Sidebar e rota**
   - Item "Conciliação Bancária" no `AppSidebar` (ícone `ArrowLeftRight`), abaixo de "Contas".
   - Rota `/conciliacao-bancaria` em `App.tsx`.

8. **Cron diário** — `pg_cron` chamando `asaas-sync` 1×/dia (executa para todas as integrações ativas).

Vou implementar tudo na sequência sem mais perguntas.