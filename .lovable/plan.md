## Diagnóstico

A Eva mandou as duas mensagens contraditórias ("Eva voltou a responder!" e logo depois "🛠️ A Eva está em manutenção…") porque o kill switch no `whatsapp-webhook` tem **default invertido e inseguro**:

```ts
const maintenanceMode = (Deno.env.get("EVA_MAINTENANCE_MODE") ?? "on").toLowerCase();
if (maintenanceMode !== "off" && maintenanceMode !== "false" && maintenanceMode !== "0") {
  // responde mensagem de manutenção
}
```

Problemas:
1. **Default = `"on"`** → se o secret não estiver presente/propagado na edge function naquele momento, ela cai em manutenção automaticamente.
2. Mesmo tendo setado `EVA_MAINTENANCE_MODE=false`, qualquer valor diferente exato de `off`/`false`/`0` (espaço, maiúscula estranha, valor antigo em cache de deploy) ativa manutenção.
3. Resultado: a usuária (Drogaria Total Itatiba) recebeu a mensagem de "voltei" às 12:42 e ao testar às 12:48 caiu no kill switch de novo.

## Plano

### 1. Inverter o default do kill switch (seguro por padrão)
Em `supabase/functions/whatsapp-webhook/index.ts` (~linha 634):

- Default passa a ser `"off"`.
- Só ativa manutenção quando o secret está explicitamente em `on`/`true`/`1`.
- Log mais claro indicando o valor lido.

```ts
const maintenanceMode = (Deno.env.get("EVA_MAINTENANCE_MODE") ?? "off").trim().toLowerCase();
const isMaintenance = maintenanceMode === "on" || maintenanceMode === "true" || maintenanceMode === "1";
if (isMaintenance) {
  console.log("MAINTENANCE_MODE ON — short-circuiting reply for phone:", phone);
  // … resposta de manutenção
}
```

### 2. Garantir o estado do secret
- Atualizar `EVA_MAINTENANCE_MODE` para `off` (valor canônico, sem espaços).
- Assim, mesmo com o código novo, o secret também confirma o estado.

### 3. Reenviar confirmação para a Drogaria Total Itatiba
Disparar via Evolution API uma única mensagem para o número que recebeu o falso "em manutenção" (+55 11 92692-6629) avisando que já está 100% liberada.

### 4. Validação
- Conferir nos logs do edge function `whatsapp-webhook` que a próxima mensagem recebida **não** entra no branch de manutenção.
- Acompanhar o AI Gateway para confirmar que a chamada ao Gemini volta a ocorrer.

## Detalhes técnicos
- Arquivo único alterado: `supabase/functions/whatsapp-webhook/index.ts` (bloco do kill switch).
- Sem mudanças de schema, sem migrações, sem impacto em UI.
- Secret atualizado via `secrets--update_secret`.
- Mensagem de aviso enviada via Evolution API (mesmo padrão já utilizado anteriormente).

Posso seguir com a implementação?