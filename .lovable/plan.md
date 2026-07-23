
## O que o usuário relatou

- Na importação ao vivo e no preview: parte dos itens veio categorizada (algumas corretas), outras erradas, outras vazias.
- Falta feedback visual enquanto a IA está trabalhando — o usuário fica sem saber se ainda está processando.

## Escopo desta rodada

Foco em **UX de carregamento**. A precisão da IA fica como um ajuste menor de prompt no mesmo passe (sem mudar arquitetura), já que a infra de paths hierárquicos + Promise.all da rodada anterior está de pé.

## 1. Overlay glassmorphism no Stage 2 (Conciliar & Categorizar)

Arquivo: `src/components/lancamentos/ImportStatementModal.tsx` + `src/components/lancamentos/import/ReconcileStep.tsx`.

- Já temos `loading` exposto pelo `useCategorySuggestions()`. Propagar como prop `categorizing: boolean` para o `ReconcileStep`.
- No `ReconcileStep`, renderizar overlay absoluto sobre a lista de linhas enquanto `categorizing === true`:
  - `absolute inset-0 z-20 backdrop-blur-md bg-background/40` (glassmorphism usando tokens semânticos).
  - Centralizado: spinner (`Loader2` animado do lucide, cor `text-primary`) + texto "EVA está categorizando 135 lançamentos…" (contagem dinâmica) + barra de progresso indeterminada (`Progress` do shadcn sem valor, ou um `<div>` com animação `animate-pulse`).
  - Segundo texto menor: "Isso pode levar alguns segundos em extratos grandes."
- Bloquear interação com os selects enquanto rola (o overlay cobre; `pointer-events-auto` no overlay basta).
- O rodapé do modal (Voltar / Importar) fica fora do overlay para o usuário poder cancelar.

## 2. Barra de progresso real (opcional dentro desta rodada)

`useCategorySuggestions` hoje só expõe boolean. Trocar por:

```ts
{ suggest, suggestions, loading, progress: { done, total }, reset }
```

- Stage 1 (histórico) é síncrono → conta como `done += resolvedByHistory` de uma vez.
- Stage 2: como os batches rodam em `Promise.all`, incrementar `done` no `.then()` de cada batch (mudar `Promise.all(batches.map(runBatch))` para versão que reporta progresso via callback). Callback passado do hook para a função.
- `ReconcileStep` mostra `done/total` na barra.

Se ficar complexo, na v1 do overlay entra só spinner + texto; a barra determinística fica pra rodada seguinte.

## 3. Ajuste no prompt da IA (`suggest-categories`)

Sem mexer em arquitetura, endurecer regras que estavam causando erro:

- Reforçar no `systemPrompt`: "Se nenhum caminho for claramente aplicável, retorne confidence=low (será descartado). NÃO invente correspondências fracas."
- Adicionar exemplos negativos: "IBERIA LINEA → Férias > Aéreo > Iberia (high). SPAY → Supérfulo > Perfume (medium). Descrição genérica tipo 'PAGAMENTO' → low."
- Manter Gemini Flash + Promise.all já implementados.

## 4. Remover log de diagnóstico

O `console.log("[useCategorySuggestions] summary", …)` cumpriu o papel. Remover.

## O que NÃO muda

- Janela de 12 meses, gate de 1 token longo, Promise.all, modelo Gemini Flash — tudo permanece.
- Estrutura do Stage 1 (matching por histórico) permanece.

## Pergunta antes de implementar

O overlay com **spinner + texto** já resolve pro seu fluxo, ou você quer que eu já entregue com a **barra determinística** mostrando `X de Y categorizados`? A segunda opção exige refatorar `useCategorySuggestions` pra reportar progresso e adiciona ~30 min de trabalho.
