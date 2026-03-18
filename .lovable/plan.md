

## Bug: Mensagens efêmeras (Apple Pay / disappearing messages) não detectadas

### Problema
Quando o usuário envia uma imagem/áudio/documento com "mensagens temporárias" ativadas no WhatsApp, a Evolution API entrega o conteúdo dentro de um wrapper `ephemeralMessage.message.{imageMessage|audioMessage|documentMessage}` ao invés de diretamente em `message.{imageMessage|...}`.

O código atual (linhas 164-179) só verifica `msgContent?.imageMessage`, `msgContent?.documentMessage` e `msgContent?.audioMessage`, ignorando completamente o wrapper ephemeral.

**Log comprovando o bug** (mensagem `4A503EDE44C15DCD2DDE` às 16:09):
- `MESSAGE KEYS: ["messageContextInfo", "ephemeralMessage"]`
- `hasImage: false` — imagem com caption "Almoço" foi ignorada

### Solução

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

**1. Unwrap ephemeralMessage** (após linha 164, antes da detecção de mídia)

Adicionar lógica para "desempacotar" a mensagem efêmera antes de extrair texto e mídia:

```typescript
// Unwrap ephemeral messages (disappearing messages)
let msgContent = msgData.message;
if (msgContent?.ephemeralMessage?.message) {
  msgContent = { ...msgContent.ephemeralMessage.message, ...msgContent };
  delete msgContent.ephemeralMessage;
}
```

Isso faz com que `msgContent.imageMessage`, `msgContent.audioMessage` e `msgContent.documentMessage` fiquem disponíveis normalmente, sem alterar nenhuma outra parte do código.

**2. Nenhuma outra mudança necessária** — todo o pipeline de detecção de mídia (hasImage, hasDocument, hasAudio), fetch de base64, e envio para a IA já funciona corretamente; o único problema é que o conteúdo estava escondido dentro do wrapper ephemeral.

### Deploy
Redeploy da edge function `whatsapp-webhook`.

