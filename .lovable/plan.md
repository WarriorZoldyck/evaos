

## Anexar mídia e texto original aos lançamentos via WhatsApp

### Problema atual
Quando o usuário envia uma foto de comprovante ou áudio pelo WhatsApp, a EVA extrai os dados e cria o lançamento, mas **não anexa a imagem** nem **salva o texto/transcrição original** no lançamento.

### Solução

#### 1. Criar bucket de storage no Supabase
- Criar bucket público `whatsapp-attachments` para armazenar as imagens/documentos recebidos
- RLS: permitir leitura pública (URLs públicas) e inserção via service role

#### 2. Atualizar a Edge Function `whatsapp-webhook`
No fluxo de criação de lançamento (todas as inserções de `transactions`):

**Para imagens/documentos (foto de comprovante, PDF):**
- Após obter o `imageBase64`, fazer upload para o bucket `whatsapp-attachments` com nome `{userId}/{timestamp}.{ext}`
- Gerar URL pública e salvar no campo `attachment_url` da transação
- Tamanho controlado: imagens WhatsApp já vêm comprimidas (~100-300KB)

**Para áudio (nota de voz):**
- A IA já transcreve o áudio — capturar a transcrição da resposta da IA
- Salvar o texto original do usuário (ou transcrição) no campo `notes` do lançamento, com prefixo `[Via WhatsApp]`
- Não armazenar o áudio em si (pesado e desnecessário)

**Para texto:**
- Salvar a mensagem original do usuário no campo `notes`, com prefixo `[Via WhatsApp]`
- Se a IA já extraiu `notes` adicionais, combinar ambos

#### 3. Detalhes técnicos

- **Storage upload**: Usar `supabase.storage.from('whatsapp-attachments').upload(path, buffer, { contentType })`
- **Conversão**: `base64` → `Uint8Array` para upload
- **Campos afetados**: `attachment_url` (imagem/PDF) e `notes` (texto original + observações da IA)
- **Performance**: Upload é assíncrono mas rápido (~100-300KB por imagem WhatsApp)
- **Pontos de inserção**: Existem ~4 locais no webhook onde `transactions.insert` é chamado (fluxo direto, após criar categoria, após escolher conta) — todos serão atualizados

#### 4. Arquivos modificados
- **Nova migration SQL**: Criar bucket `whatsapp-attachments` com política de acesso
- **`supabase/functions/whatsapp-webhook/index.ts`**: Adicionar lógica de upload de mídia e persistência de texto original nos lançamentos

