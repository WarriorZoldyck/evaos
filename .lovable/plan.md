

## Reconfigurar webhook da Evolution API para receber `MESSAGES_UPSERT`

### Diagnóstico
Os logs confirmam: nenhum evento `messages.upsert` chega ao webhook. Só chegam `contacts.update`, `chats.update`, `messages.update` e `connection.update`. O evento principal de mensagens novas foi perdido (provavelmente após reconexão da instância).

### Plano

**1. Criar edge function temporária `evolution-webhook-config`**

Uma função simples que:
- **GET**: Consulta a configuração atual do webhook na Evolution API (`GET /webhook/find/{instance}`)
- **POST**: Atualiza o webhook com todos os eventos necessários, incluindo `MESSAGES_UPSERT`

A função usará as secrets já existentes: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.

**2. Deploy e execução**

- Deploy da function
- Chamar via `curl_edge_functions` primeiro com GET para ver a config atual
- Depois com POST para atualizar, definindo o webhook com:
  - URL: `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook`
  - Events: `["MESSAGES_UPSERT"]`
  - `webhookByEvents: false`
  - `enabled: true`

**3. Verificação**

- Consultar novamente a config para confirmar que `MESSAGES_UPSERT` está ativo
- Pedir ao cliente para enviar uma mensagem de teste

### Arquivo

- `supabase/functions/evolution-webhook-config/index.ts` (novo, temporário)
- `supabase/config.toml` (adicionar entry para a nova function)

