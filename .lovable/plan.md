

# Diagnóstico: WhatsApp Webhook com Boot Failure

## Situacao

O erro **"Unexpected reserved word at line 2140"** (compilada) nos logs e um **erro real de codigo**, NAO um problema de instancia desconectada. A instancia Evolution pode estar conectada normalmente, mas o webhook nao consegue iniciar para processar mensagens.

## Causa Raiz

Linhas 2356-2357 do source usam `await` dentro de um `.map()` que NAO e `async`:

```typescript
// Linha 2323 — callback NÃO é async
const pendingTxs = installmentDetails.map((detail, idx) => {
  // ...
  const seriesFp2 = await generateSeriesFingerprint(...);  // ERRO
  const seriesDupStatus = await checkAndSetDuplicateStatus(...); // ERRO
  return { ... };
});
```

Isso causa um SyntaxError que impede o boot da funcao inteira. Nenhuma mensagem do WhatsApp esta sendo processada enquanto isso persistir.

## Correção Necessária

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

Mover o calculo de fingerprint e status de duplicata para **antes** do `.map()`, ja que sao valores identicos para todas as parcelas da serie:

```typescript
// ANTES do .map() — calcular uma vez
const totalSeriesAmt = installmentDetails.reduce((s, d) => s + Math.abs(d.amount || 0), 0);
const seriesFp = await generateSeriesFingerprint(description, totalSeriesAmt, competenceDate);
const seriesDupStatus = await checkAndSetDuplicateStatus(supabase, userId, seriesFp, true);

// .map() agora sem await — usa valores já resolvidos
const pendingTxs = installmentDetails.map((detail, idx) => ({
  // ... campos ...
  status: seriesDupStatus,
  fingerprint: seriesFp,
}));
```

## Impacto

- O webhook esta **100% parado** — nenhuma mensagem WhatsApp e processada
- A correção e simples (mover 3 linhas) e restaura o funcionamento completo
- Nao ha necessidade de reconectar a instancia Evolution

## Arquivo afetado

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Mover `await` para fora do `.map()` + redeploy |

