
## Diagnóstico

Nos logs da última interação (`01:02:11 BOLETO MATCH FOUND`), o match aconteceu e o pending foi criado — mas **nenhum** log de `Evolution sendMedia`, `sendList`, `sendButtons` ou erro do `renderBoletoCardPng` apareceu. O único envio ao WhatsApp foi o `sendText` do `respond()`, que hoje omite a mensagem de sugestão quando há match.

Causa: o bloco `(async () => { ... })().catch(...)` é fire-and-forget. Assim que `respond()` retorna, o runtime da Supabase Edge encerra o isolate e mata a promise pendente — o PNG nunca é renderizado nem enviado. É o comportamento padrão do Deno Deploy; precisa de `EdgeRuntime.waitUntil()` para manter o worker vivo até a promise terminar.

Somado a isso, o usuário quer que a mensagem de "encontrei um parecido" chegue **na mesma resposta** do lançamento — hoje ela é intencionalmente omitida do `respond()`.

## Ajustes em `supabase/functions/whatsapp-webhook/index.ts`

1. **Reincluir a sugestão no `respond()` principal** quando há match, dentro de uma única mensagem:
   ```
   📋 Lançamento enviado para aprovação no app!
   📝 …
   💰 …
   …
   
   ━━━━━━━━━━━━━━━━━━
   📄 Encontrei um lançamento pendente parecido:
   • <descrição>
   • R$ <valor> · venc. <data>
   
   Responda:
   1 — ✅ Sim, dá baixa
   2 — ❌ Não, é outro
   3 — ✏️ Editar no app
   👉 <deep-link com ctx>
   ```
   Assim, mesmo se o envio da imagem falhar, o usuário sempre tem o texto + as 3 opções na mesma mensagem do lançamento. O `[SUGESTAO_BAIXA]` continua no `notes` do pending como hoje.

2. **Manter o isolate vivo** para o envio do PNG e da lista:
   ```ts
   const dispatch = (async () => { …renderBoletoCardPng + sendEvolutionImage + sendEvolutionList… })()
     .catch(e => console.error("boleto card/list dispatch failed:", e));
   // Deno Deploy: EdgeRuntime.waitUntil mantém o worker vivo após respond()
   try { (globalThis as any).EdgeRuntime?.waitUntil?.(dispatch); } catch {}
   ```
   Fallback silencioso se `EdgeRuntime` não estiver disponível (local dev).

3. **Instrumentação de log** dentro do dispatch:
   - `console.log("boleto dispatch: rendering PNG…")`
   - `console.log("boleto dispatch: PNG bytes =", png?.byteLength ?? null)`
   - `console.log("boleto dispatch: sendMedia result =", sentImage)`
   - `console.log("boleto dispatch: sendList result =", listOk)`
   
   Sem isso não temos como saber onde parou.

4. **Caption da imagem** deixa de duplicar o bloco todo (o texto já foi no `respond`); vira algo curto tipo:
   `📄 Sugestão de baixa — responda 1/2/3 na mensagem anterior.`

5. **Nada muda** no card visual, no dispatcher `confirm_boleto_match`, no `ctx` do deep link, ou no `AnalisesEva.tsx`.

## Memória
Atualizar `.lovable/memory/whatsapp/boleto-reconciliation.md`:
- Sugestão passa a viajar dentro da mesma resposta do `respond()` (texto + numbered fallback + deep link).
- Imagem e `sendList` são complementares, disparados via `EdgeRuntime.waitUntil` (obrigatório em edge functions Supabase — sem isso o isolate morre antes do envio).
- Caption da imagem é mínima.

Sem migrations, sem alteração de UI.
