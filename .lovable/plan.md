## Objetivo
Remover completamente a sugestão via IA na importação de extrato. Manter **apenas** o cruzamento com o histórico do próprio usuário (Layer 0 — descrição normalizada) + os matches determinísticos por merchant key/prefix/tokens que também vêm do histórico. Se não houver match no histórico, a linha fica **"Sem categoria"** para o usuário ajustar manualmente.

## Mudanças

### 1. `src/hooks/useCategorySuggestions.ts`
- Remover a chamada à edge function `suggest-categories` (Stage 2 / IA).
- Remover a flag/label "sugerido pela IA" do retorno — todo match passa a ser "baseado no histórico" (ou nada).
- Manter Layer 0 (descrição normalizada idêntica) e as camadas determinísticas de merchant key / prefix / token overlap com consenso ≥60%, todas alimentadas por `transactions` (24m/5k) + `ai_pending_transactions` aprovadas.
- Linhas sem match → `categoryId: null` / "Sem categoria".
- Ajustar `suggestLoading` para refletir só a fase de histórico (bem mais rápida).

### 2. `src/components/lancamentos/import/ReconcileStep.tsx`
- Remover a badge/texto "✨ sugerido pela IA" — só permanece o rótulo "📖 baseado no histórico" quando houver match.
- Overlay de carregamento continua igual, só muda o texto para algo como "EVA está cruzando com seu histórico…".

### 3. `supabase/functions/suggest-categories/index.ts`
- Não vamos deletar a função (evita quebrar deploys/histórico), mas ela deixa de ser chamada. Opcional: adicionar um comentário no topo marcando como deprecated.

## Resultado esperado
- `LE BOMBOM 03/03` → casa com `LE BOMBOM` no histórico → `Vestuário › Roupas › Vitória`.
- Descrições sem histórico compatível → `Sem categoria`, sem "chutes" da IA.
- Importação fica mais rápida (sem round-trip pra Gemini) e mais previsível.
