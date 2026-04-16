

## Plano: Corrigir rejeição do webhook do WhatsApp

### Causa raiz
A correção de segurança anterior adicionou validação de `WHATSAPP_WEBHOOK_SECRET` no `whatsapp-webhook`. Como esse secret está configurado no Supabase mas a Evolution API não envia o header correspondente (`x-webhook-secret` ou `apikey`), **todas as requisições estão sendo rejeitadas com 401**.

### Solução
Remover a validação condicional do `WHATSAPP_WEBHOOK_SECRET` no webhook. A Evolution API já autentica via sua própria `apikey` no lado da instância — o webhook do Supabase não tem como impor um secret que a Evolution não envia.

Em vez disso, manter a validação existente baseada no `apikey` header que a Evolution já envia (conforme documentado em `mem://whatsapp/security-auth`).

### Alteração

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

- Remover o bloco de validação de `WHATSAPP_WEBHOOK_SECRET` (linhas 354-367)
- Manter o fluxo existente que já valida o `apikey` da Evolution API (conforme a memória do projeto)

### Verificação
- Após deploy, confirmar nos logs que as mensagens voltam a ser processadas
- Pedir ao Renato para reenviar o áudio

