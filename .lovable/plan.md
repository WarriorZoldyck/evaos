

# Integração Direta com Evolution API (sem N8N)

## Diagnóstico do problema atual

Os logs confirmam tudo:

1. **N8N com "Using Fields Below"** envia `{"phone":"556499998901"}` — **sem o campo `message`**. O N8N está descartando o campo `message` silenciosamente (provavelmente o valor da expressão `{{ $json.mensagem }}` está vazio no nó anterior, ou o campo não está sendo passado corretamente).

2. **N8N com "Using JSON"** funciona quando a mensagem é longa (vide log com o comprovante PIX), mas falha quando a expressão tem caracteres especiais.

Em vez de continuar debugando o N8N, vamos eliminar o intermediário e conectar a Evolution API direto ao webhook.

## Plano: Evolution API → Webhook direto

### 1. Modificar o webhook para aceitar payload da Evolution API

A Evolution API envia webhooks no formato `messages.upsert`:

```text
{
  "event": "messages.upsert",
  "data": {
    "key": {
      "remoteJid": "5511996346086@s.whatsapp.net",
      "fromMe": false
    },
    "message": {
      "conversation": "texto da mensagem"
      // ou "extendedTextMessage": { "text": "..." }
      // ou "imageMessage": { "caption": "..." }
    }
  }
}
```

No início da função, antes da validação, detectar se o payload é da Evolution API e normalizar para o formato interno `{ phone, message }`:

```typescript
// Detectar payload Evolution API
if (parsed.event === "messages.upsert" && parsed.data) {
  const key = parsed.data.key;
  if (key.fromMe) return 200; // ignorar mensagens enviadas por nós
  phone = key.remoteJid.replace("@s.whatsapp.net", "");
  message = parsed.data.message?.conversation 
         || parsed.data.message?.extendedTextMessage?.text
         || parsed.data.message?.imageMessage?.caption
         || "";
}
```

### 2. Adicionar envio de resposta via Evolution API

Atualmente o webhook retorna JSON mas não responde no WhatsApp. Adicionar uma chamada à Evolution API `sendText` no final para enviar a resposta de volta:

```text
POST https://api.resolvsolucoes.com.br/message/sendText/teste eva
Headers: apikey: E77F807AD386-41C1-857E-2C91A48CFDB6
Body: { "number": "5511996346086", "text": "resposta da EVA" }
```

### 3. Armazenar credenciais como secrets

- `EVOLUTION_API_URL` = `https://api.resolvsolucoes.com.br`
- `EVOLUTION_API_KEY` = `E77F807AD386-41C1-857E-2C91A48CFDB6`
- `EVOLUTION_INSTANCE` = `teste eva`

### 4. Configurar webhook na Evolution API

Registrar o webhook da Edge Function na instância da Evolution:

```text
PUT https://api.resolvsolucoes.com.br/webhook/set/teste eva
Headers: apikey: <global_key>
Body: {
  "url": "https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook",
  "webhook_by_events": false,
  "events": ["MESSAGES_UPSERT"],
  "headers": { "x-webhook-secret": "<WHATSAPP_WEBHOOK_SECRET>" }
}
```

### 5. Remover autenticação x-webhook-secret para Evolution (ou tornar opcional)

A Evolution API envia o secret no header configurado. Manter a validação, mas a Evolution pode enviar via headers customizados.

## Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | Normalizar payload Evolution + enviar resposta via sendText |

## Resultado

- Mensagem chega no WhatsApp → Evolution API envia webhook → Edge Function processa → Edge Function responde via Evolution API sendText
- Sem N8N no meio
- Bidirecional: o usuário recebe a resposta da EVA direto no WhatsApp

