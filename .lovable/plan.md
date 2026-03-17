

# Diagnóstico: Erro 400 no N8N persiste

## O que vi no screenshot

O N8N está configurado corretamente visualmente:
- Body Content Type: JSON
- Specify Body: Using JSON
- JSON: `{ "phone": "556499998901", "message": "{{ $json.mensagem }}" }`
- A preview na parte inferior resolve corretamente para `"quais cartões tenho cadastrados..."`

Mas o erro 400 persiste: `"phone and message/image are required"`.

## Causa provável

A Edge Function pode estar rodando uma **versão antiga** que não foi redeployada após as mudanças recentes. Ou o N8N pode estar enviando o body de forma inesperada (double-encoding, charset, etc).

## Plano

### 1. Adicionar log de debug na Edge Function

Antes da validação (linha 30-36), adicionar um `console.log` do body raw recebido para diagnosticar exatamente o que chega:

```typescript
const rawBody = await req.text();
console.log("RAW BODY:", rawBody);
const parsed = JSON.parse(rawBody);
const { phone, message, image_base64, image_url } = parsed;
console.log("PARSED:", { phone, message: message?.substring(0, 50) });
```

### 2. Redeployar a Edge Function

As mudanças feitas anteriormente (payment_method map, card disambiguation, timezone fix) e este novo log precisam ser deployados.

### 3. Testar e verificar os logs

Após o deploy, executar novamente no N8N e verificar os logs para ver o que exatamente está chegando no body.

---

Isso vai revelar se o problema é:
- N8N enviando body vazio/malformado
- Double-encoding do JSON
- Expressão `{{ $json.mensagem }}` resolvendo para vazio na execução real (diferente do preview)

