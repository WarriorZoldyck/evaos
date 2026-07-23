
## Problema

No print da importação:
- **SPAY / AMAZONA / LE BOMBOM**: só a categoria pai vem preenchida ("sugerido pela IA"). Subcategoria e sub-sub ficam vazias.
- **IBERIA**: vem com 3 níveis (esse casou com um lançamento existente via `matches`, não pela sugestão).
- Categorização demora bastante em extratos grandes (135 linhas).

Duas causas independentes.

## Causa 1 — IA só devolve categoria pai

`supabase/functions/suggest-categories/index.ts` manda a lista achatada de nomes de categorias e pede só `{index, category, confidence}`. Ao receber "Supérfulo" no SPAY, nada guia a IA para Perfume, e o hook nem tem como preencher subcategoria.

## Causa 2 — Stage 1 (histórico) não está casando SPAY/AMAZONA

IBERIA veio de `matches` (lançamento gêmeo já existente no sistema com Férias/Aéreo/Iberia). SPAY/AMAZONA têm histórico equivalente no DB (payment_date 2026-01-15, dentro da janela de 12m), com tokens compatíveis, mas o print mostra "sugerido pela IA" — sinal de que Stage 1 devolveu vazio para eles. Suspeitas prováveis, em ordem:
1. `effectiveUserId` diferente do dono do histórico (impersonation do EVA Hub).
2. Race: hook dispara antes de `categories` estar completo — mas o gate `categories.length === 0` já cobre.
3. Regressão sutil no índice de tokens.

Precisa de log para eliminar a #1 antes de fingir que resolveu.

## Causa 3 — Lentidão

`suggest-categories` roda batches de 25 em série (`for … await`). 135 itens = 6 chamadas encadeadas ao Gemini. Simples de paralelizar.

## Plano

### 1. Edge function `supabase/functions/suggest-categories/index.ts`

- Enviar para a IA a hierarquia completa (category → subcategory → subcategory2), não a lista achatada.
- Pedir resposta com `{index, category, subcategory?, subcategory2?, confidence}`. Manter regra de descartar `low`.
- No servidor, validar que subcategory pertence à category escolhida (senão descarta subcategory). Idem para subcategory2.
- Rodar os batches em paralelo via `Promise.all` (mantendo chunk de 25). Um `Promise.all` de 6 chamadas ao Gemini resolve num único round-trip agregado.

### 2. Hook `src/hooks/useCategorySuggestions.ts`

- Aceitar `subcategory`/`subcategory2` na resposta da IA e propagar no `SuggestionSource`.
- Adicionar `console.log` temporário resumindo: `{effectiveUserId, historyCount, resolvedByHistory, resolvedByAI}` para diagnosticar a Causa 2 no próximo teste do usuário.

### 3. Seed no modal `src/components/lancamentos/ImportStatementModal.tsx`

Ajustar o seed do Stage 2 (linha ~841) para usar `subcategory`/`subcategory2` vindos da IA quando presentes, em vez de só passar o leaf para `resolveCategoryPath`:

```text
if (v.subcategory || v.subcategory2) {
  // usar caminho fornecido pela IA (validado no servidor)
  next[idx] = { category: v.category, subcategory: v.subcategory, subcategory2: v.subcategory2, touched: false }
} else {
  // caminho antigo — walk-up pelo leaf
  next[idx] = { ...resolveCategoryPath(v.category, categories), touched: false }
}
```

### 4. Diagnóstico do Stage 1

Depois do usuário rodar mais uma importação com o log temporário:
- Se `historyCount === 0`, é impersonation/`effectiveUserId` — corrige buscando por `user_id in (effectiveUserId, auth.uid())`.
- Se `historyCount > 0` mas `resolvedByHistory === 0`, é bug no índice de tokens — inspecionar o payload real.

Só então remover o log.

## Não muda

- Janela de 12 meses (já corrigido).
- Threshold de 1 token longo ≥6 letras (já corrigido).
- Modelo Gemini Flash usado hoje.

## Resultado esperado

- SPAY / AMAZONA / LE BOMBOM chegam com pai + filho preenchidos quando existir subcategoria adequada.
- Tempo de categorização de ~6× mais rápido em extratos grandes (batches paralelos).
- Log identifica se o Stage 1 está sofrendo com impersonation antes de assumir causa errada.
