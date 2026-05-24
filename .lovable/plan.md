
## Objetivo

1. **Separar o Pluggy** dos cards de banco. Hoje o Pluggy aparece "fantasiado" de Itaú no card do Itaú. Vamos ter um card próprio chamado **"Pluggy (Open Finance)"** — multibanco, independente.
2. **Criar integração nativa do Itaú via API** (modelo Asaas: chave/credencial direta, sem widget de terceiro).

---

## 1) Card "Pluggy (Open Finance)" — independente

**UI (`src/pages/Integracoes.tsx`)**
- Remover a lógica que filtra `pluggyIntegrations` como sendo "Itaú" e renomear o card:
  - Título: **Pluggy**
  - Subtítulo: "Open Finance multibanco (Itaú, Bradesco, Santander, C6, Nubank, etc.)"
  - Badge "Conectado" se houver qualquer `pluggyIntegrations.length > 0`.
  - Listar todas as integrações Pluggy (mostrar `institution_name`).
  - Botão "Conectar via Pluggy" abre o `PluggyConnectModal`.
- Tirar o card "Itaú" atual (que era na verdade Pluggy) e voltar o Itaú para a lista de bancos suportados nativamente (próximo passo).

**`PluggyConnectModal`**
- Remover restrição `connectorIds = [201, 218, 0]` → deixar widget abrir todos os conectores (ou aceitar lista vazia para "todos").
- Default do nome da conta passa de "Itaú" para "Conta bancária".
- Título do modal: "Conectar conta via Pluggy".

**Backend (`pluggy-connect-account`)** já salva `institution_name` vindo do `connector.name` — nada a mudar.

---

## 2) Integração Itaú via API (modelo Asaas)

**Novo card "Itaú"** no `Integracoes.tsx`, separado, com botão "Conectar Itaú" abrindo um `ItauConnectModal` (espelho do `AsaasConnectModal`).

**Banco de dados** — nova tabela `itau_integrations`:
- `user_id`, `company_id`, `bank_account_id`
- `client_id` (texto), `client_secret_encrypted` + `client_secret_iv` (AES-GCM via `_shared/asaas-crypto.ts` — reutilizando o segredo `ASAAS_KEY_ENCRYPTION_SECRET`)
- `certificate_encrypted` + `certificate_iv` (PEM mTLS, se necessário)
- `agency`, `account_number`, `account_digit`
- `environment` ('sandbox' | 'production')
- `last_sync_at`, `sync_status`, `last_error`, `initial_balance_synced`
- RLS por `user_id`.

**Hook** `useItauIntegration.ts` (espelho do `useAsaasIntegration`): `list`, `connect`, `sync`, `disconnect`.

**Edge functions** novas:
- `itau-connect-account` — recebe credenciais, valida com chamada de teste, cria/vincula `bank_account`, persiste registro.
- `itau-sync` — busca extrato e cria itens em `asaas_sync_items` com `provider='itau'` para reaproveitar o fluxo de conciliação bancária existente.
- `itau-disconnect-account`.

**`asaas_sync_items.provider`** — já é colunizado para 'pluggy'; adicionar valor 'itau' (sem mudança de schema, é texto).

---

## Itens que preciso confirmar antes de implementar

A API do Itaú para conta-corrente é **Open Finance Itaú** (PJ ou PF), que exige:
- `client_id` + `client_secret`
- Certificado **mTLS** (par chave/cert PEM) emitido pelo Itaú Developer
- Cadastro prévio do app no portal `developer.itau.com.br`

Não há um equivalente direto da "API Key" simples do Asaas. Antes de eu criar a tabela e as edge functions, confirme:

1. **Qual API do Itaú?** Open Finance (extrato/saldo PJ), Cash Management (PIX/boletos PJ), ou iti (PF)?
2. **Você já tem credenciais** (`client_id`/`client_secret` + certificado .pem mTLS) no Itaú Developer? Sem isso a conexão não autentica.
3. Topo deixar Pluggy como fallback para Itaú também (caso o usuário não tenha credenciais Itaú)?

Vou esperar essas respostas para finalizar o esquema da tabela e o fluxo do modal Itaú — o passo 1 (separar Pluggy) eu já consigo executar independentemente.
