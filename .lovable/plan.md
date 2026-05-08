## Conciliação Bancária com Asaas

Nova página **Conciliação Bancária** que conecta a conta Asaas do usuário (via API Key dele), importa extrato + cobranças, e cruza automaticamente com os lançamentos já existentes no EVA.

### 1. Conexão da conta Asaas (por usuário)

Em **Integrações**, transformar o card "Asaas" (hoje "Em breve") em um card ativo "Conectar":
- Modal pede a **API Key de produção do Asaas** do usuário (link com instruções).
- Usuário escolhe:
  - **Criar nova conta bancária "Asaas"** → busca saldo atual via API e grava como `initial_balance`.
  - **Vincular a uma conta existente** → seleciona da lista de `bank_accounts`.
- Edge function `asaas-connect-account` valida a key (chama `/v3/finance/balance`) e salva.

### 2. Banco de dados (nova tabela)

- `asaas_integrations`: `user_id`, `company_id`, `bank_account_id`, `api_key_encrypted`, `last_sync_at`, `sync_status`, `initial_balance_synced`.
- `asaas_sync_items` (staging do que veio do Asaas): `integration_id`, `asaas_id`, `type` (payment/transfer), `amount`, `date`, `description`, `status`, `matched_transaction_id`, `match_status` (`pending`, `matched`, `ignored`, `imported`), `payload jsonb`.
- RLS: dono do `user_id` enxerga só os seus.
- A API Key é guardada **criptografada** (via secret de criptografia no edge function — nunca exposta ao frontend).

### 3. Sincronização (edge function `asaas-sync`)

Disparada manualmente pelo botão "Sincronizar agora" e via cron diário:
- Puxa **extrato** (`/v3/financialTransactions`) e **cobranças recebidas/pagas** (`/v3/payments?status=RECEIVED|CONFIRMED`).
- Insere/atualiza em `asaas_sync_items` (idempotente por `asaas_id`).
- Roda o **matcher**: para cada item pendente, busca em `transactions` da conta vinculada por valor exato + data ±3 dias. Match único → marca `matched`. Múltiplos candidatos → fica `pending` com sugestões.

### 4. Página `/conciliacao-bancaria`

Layout estilo Conta Azul, com filtros por conta e período:

```text
┌─ Conta: [Asaas ▼]  Período: [últimos 30d]  [Sincronizar]
├─ Saldo Asaas: R$ X   |   Saldo Sistema: R$ Y   |   Diferença: R$ Z
├──────────────────────────────────────────────────────────────────
│ Banco (Asaas)                  ⇄  Sistema (EVA)
│ 12/05  PIX João  R$ 100  →  ✓ Match: "Recebimento João" [confirmar]
│ 11/05  Boleto    R$ 250  →  ⚠ 2 sugestões [escolher ▼]
│ 10/05  Tarifa    R$ 5    →  ✗ Sem match  [criar lançamento] [ignorar]
└──────────────────────────────────────────────────────────────────
```

Ações por linha:
- **Confirmar match** → grava `matched_transaction_id` e marca `transactions.is_reconciled = true`.
- **Escolher outro** → lista lançamentos próximos da conta.
- **Criar lançamento** → abre modal de novo lançamento já preenchido com dados do Asaas.
- **Ignorar** → marca como `ignored`.

Aba secundária "Conciliados" mostra histórico do que já foi batido.

### 5. Navegação e acesso

- Novo item no `AppSidebar`: **Conciliação Bancária** (ícone `ArrowLeftRight`), abaixo de "Contas".
- Rota `/conciliacao-bancaria` em `App.tsx`, dentro de `AppLayout` (protegida por `SubscriptionGuard`).
- Card "Asaas" em `Integracoes.tsx` muda para ativo quando há `asaas_integrations` para o usuário, com botão "Sincronizar" e "Desconectar".

### 6. Detalhes técnicos

- **Edge functions novas**: `asaas-connect-account`, `asaas-sync`, `asaas-disconnect-account`. Todas validam JWT via `getClaims`.
- **Criptografia da API Key**: AES-GCM usando novo secret `ASAAS_KEY_ENCRYPTION_SECRET` (32 bytes) — vou pedir quando começarmos a implementar.
- **Cron**: agendar `asaas-sync` 1×/dia via `pg_cron` para todas as integrações ativas.
- **Matching algorítmico**: prioriza match exato de valor + janela de data; empate é resolvido com proximidade de descrição (Levenshtein simples) — se ainda houver empate, fica pendente.
- **Saldo do sistema**: reusa `get_account_balance(bank_account_id)`. Saldo Asaas vem fresco da API a cada sync.
- **Contexto Pessoal/Empresa**: a `bank_account` vinculada já carrega `company_id`, então a página respeita o seletor global automaticamente.

### O que NÃO entra agora

- Conciliação de outros bancos (Bradesco/Itaú/etc.) — segue "Em breve".
- Geração de cobrança via Asaas a partir do app (separado das cobranças da assinatura, que já existe).
- OFX/CSV manual — pode vir num passo futuro.