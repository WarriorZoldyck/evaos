

# Integração Evolution API — 100% Direto (sem N8N) ✅

## O que foi feito

1. **Webhook reescrito** — 100% Evolution API, sem branch N8N legado
2. **Bug de escopo corrigido** — `phone` declarado antes do try/catch
3. **Secret `EVOLUTION_API_URL` corrigido** — estava com valor da API key, agora tem a URL correta
4. **Webhook registrado** na instância "teste eva" com evento `MESSAGES_UPSERT`
5. **Mensagens ignoradas**: `fromMe`, grupos (`@g.us`), eventos não-message
6. **Resposta bidirecional** via Evolution `sendText`

## Fluxo atual

```
WhatsApp → Evolution API → Edge Function (webhook) → processa com IA → responde via Evolution sendText → WhatsApp
```

## Configuração Evolution

- Instância: `teste eva`
- Webhook URL: `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook`
- Eventos: `MESSAGES_UPSERT`
- webhookByEvents: false
