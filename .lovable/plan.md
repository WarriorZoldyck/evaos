

## Suporte a Imagens no WhatsApp (Visão Computacional)

### Problema
Quando o usuário envia uma imagem (ex: foto de comprovante/nota fiscal) com legenda, a EVA só lê o texto da legenda e ignora o conteúdo visual. Resultado: registra R$0 porque o valor estava na imagem.

### Solução
Adicionar processamento de imagem no webhook usando:
1. **Evolution API** `getBase64FromMediaMessage` para baixar a imagem como base64
2. **Lovable AI Gateway** com mensagem multimodal (content com `image_url` tipo `data:image/...;base64,...`) para o Gemini analisar o conteúdo visual junto com o texto

### Alterações em `supabase/functions/whatsapp-webhook/index.ts`

**1. Extrair mediaMessage do payload Evolution**
- Detectar `imageMessage` (e opcionalmente `documentMessage` para PDFs futuros)
- Extrair o `key.id` (messageId) necessário para o endpoint getBase64

**2. Nova função `getImageBase64(messageId)`**
- Chamar `POST {EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instance}` com `{ message: { key: { remoteJid, fromMe: false, id: messageId } } }`
- Retornar o base64 da imagem

**3. Alterar a chamada à IA para multimodal**
- Se há imagem, montar o content como array:
  ```json
  [
    { "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,..." } },
    { "type": "text", "text": "legenda do usuário (ou 'Analise esta imagem')" }
  ]
  ```
- Se não há imagem, manter o formato atual (string simples)

**4. Aceitar mensagens de imagem sem legenda**
- Atualmente, `!message` retorna erro 400. Alterar para permitir imagens sem texto, usando um texto default como "Analise esta imagem e extraia as informações do lançamento."

### Fluxo resultante
```
Usuário envia foto do comprovante com legenda "Almoço débito Itaú"
→ Webhook detecta imageMessage
→ Baixa base64 via Evolution getBase64
→ Envia para Gemini como mensagem multimodal (imagem + texto)
→ Gemini lê o valor R$45,90 da imagem + entende o contexto da legenda
→ Registra lançamento com valor correto
```

### Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts`

