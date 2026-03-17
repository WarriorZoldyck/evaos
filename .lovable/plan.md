

# Integração Evolution API — Concluída ✅

## O que foi feito

1. **Secrets adicionados**: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
2. **Webhook atualizado** para detectar payload da Evolution API (`messages.upsert`) e normalizar para o formato interno
3. **Resposta bidirecional**: todas as respostas da EVA agora são enviadas de volta via Evolution API `sendText`
4. **Webhook registrado** na instância "teste eva" da Evolution API apontando para a Edge Function
5. **Mensagens `fromMe` ignoradas** para evitar loops infinitos

## Como funciona agora

```
WhatsApp → Evolution API → Edge Function (webhook) → processa com IA → responde via Evolution sendText → WhatsApp
```

Sem N8N no meio. O fluxo é direto e bidirecional.
