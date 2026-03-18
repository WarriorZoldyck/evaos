

## Suporte a PDFs no WhatsApp (EVA)

### Problema
Atualmente a EVA só detecta `imageMessage`. Quando o usuário envia um PDF pelo WhatsApp, o payload vem como `documentMessage` e é ignorado.

### Solução
Estender o webhook para detectar `documentMessage`, baixar o base64 via Evolution API (mesmo endpoint `getBase64FromMediaMessage`), e enviar ao Gemini como conteúdo multimodal com `file` type (igual ao `parse-bank-statement` já faz).

### Alterações em `supabase/functions/whatsapp-webhook/index.ts`

1. **Extrair texto de documentMessage**
   - Adicionar `msgContent?.documentMessage?.caption` na cadeia de extração de texto
   
2. **Detectar documento**
   - Adicionar `hasDocument = !!msgContent?.documentMessage` além do `hasImage`
   - Considerar `hasMedia = hasImage || hasDocument`
   - Usar `hasMedia` onde atualmente usa `hasImage`

3. **Baixar base64 do documento**
   - Reutilizar a mesma função `getImageBase64` (Evolution API usa o mesmo endpoint para qualquer mídia)

4. **Enviar ao Gemini como multimodal**
   - Se for documento (PDF), usar o formato `file` com `data:application/pdf;base64,...` em vez de `image_url`
   - Se for imagem, manter o formato atual `image_url`
   - Detectar o mimetype: `documentMessage.mimetype` ou fallback `application/pdf`

5. **Permitir mensagens só com documento (sem legenda)**
   - Alterar condição `(!message && !hasImage)` para `(!message && !hasMedia)`

### Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts`

