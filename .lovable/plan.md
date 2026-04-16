

## Plano: Redeployar o webhook do WhatsApp

### Situação
O código no repositório já está correto — o bloco de validação do `WHATSAPP_WEBHOOK_SECRET` foi removido na correção anterior. Porém, a versão **deployada** ainda é a antiga (os logs mostram "Webhook secret mismatch" às 00:29). A função precisa apenas ser redeployada.

### Ação
1. Redeployar a edge function `whatsapp-webhook`
2. Verificar nos logs que requisições passam a ser processadas (sem 401)
3. Pedir ao Renato para reenviar o áudio de teste

### Nenhuma alteração de código necessária
O arquivo `supabase/functions/whatsapp-webhook/index.ts` já está correto.

