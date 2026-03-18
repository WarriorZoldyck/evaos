


# Integração Evolution API — 100% Direto (sem N8N) ✅

## O que foi feito

1. **Webhook reescrito** — 100% Evolution API, sem branch N8N legado
2. **Bug de escopo corrigido** — `phone` declarado antes do try/catch
3. **Secret `EVOLUTION_API_URL` corrigido** — estava com valor da API key, agora tem a URL correta
4. **Webhook registrado** na instância "teste eva" com evento `MESSAGES_UPSERT`
5. **Mensagens ignoradas**: `fromMe`, grupos (`@g.us`), eventos não-message
6. **Resposta bidirecional** via Evolution `sendText`
7. **Visão computacional** — suporte a imagens via `getBase64FromMediaMessage` + Gemini multimodal ✅
8. **Memória de conversa** — histórico completo do dia enviado como contexto para a IA ✅
9. **Escolha de conta** — quando há múltiplas contas, pergunta ANTES de registrar e guarda em pending_actions ✅

## Fluxo atual

```
WhatsApp → Evolution API → Edge Function (webhook) → carrega histórico do dia → processa com IA (texto + imagem + contexto) → responde via Evolution sendText → WhatsApp
```

## Memória de Conversa ✅

- Tabela `whatsapp_messages` armazena todas as mensagens (user + assistant)
- Carrega histórico completo do dia (até 50 mensagens) antes de cada processamento
- Envia histórico como mensagens adicionais no chat da IA
- Permite follow-ups naturais ("R$45,90" como resposta a "qual o valor?")

## Escolha de Conta (Pending Actions) ✅

- Se múltiplas contas/carteiras existem e o usuário não especificou qual, a EVA pergunta
- Payload completo é salvo em `whatsapp_pending_actions` com `action_type: "choose_account"`
- Quando o usuário responde com o nome da conta, o lançamento é criado automaticamente
- Suporta tanto contas bancárias/carteiras quanto cartões de crédito

## Configuração Evolution

- Instância: `teste eva`
- Webhook URL: `https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook`
- Eventos: `MESSAGES_UPSERT`
- webhookByEvents: false
