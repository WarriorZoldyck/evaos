## Objetivo

Aumentar a taxa de auto-categorização no import de extrato, combinando duas melhorias no pipeline atual (`useCategorySuggestions` + `suggest-categories`).

## Diagnóstico (confirmado com dados)

Último import do usuário `espclin@hotmail.com` (contexto Eva, 115 lançamentos): apenas 4 vieram categorizados — exatamente os 4 merchants já categorizados manualmente no import anterior (SPAY POLIMPORT, IBERIA, AMAZONA WESTERN, PEDRO VITOR). O aprendizado funciona; só cobriu pouco porque:

1. O Estágio 1 (histórico) exige **≥ 2 tokens de 4+ letras** em comum. Merchants como "NETFLIX", "MAGALU", "DROGASIL", "AMAZON MARKETPLACE CC" têm 1 único token útil.
2. O Estágio 2 (IA) hoje devolve categoria só quando o modelo tem alta confiança; em descrições curtas/abreviadas de cartão ele retorna `null` com frequência.

## Mudanças

### 1) `src/hooks/useCategorySuggestions.ts` — gate de 1 token longo

- Manter a regra atual de "≥ 2 tokens" como padrão.
- Adicionar exceção: se o melhor triplo pontuou **1 token** mas esse token tem **≥ 6 letras**, aceitar o match (`best.score >= 2 || (best.score === 1 && longToken)`).
- Ao pontuar, marcar se o token vencedor era longo (tracking já dentro do loop de `tripleCounts`).
- Não mexer na janela de 6 meses nem no limite de 2000 registros.

Efeito: "NETFLIX", "PRUDENTIAL", "AMAZON", "DROGASIL", "MAGALU", "SHOPEE" passam a casar a partir de 1 lançamento categorizado no passado.

### 2) `supabase/functions/suggest-categories/index.ts` — sugerir sempre com nível de confiança

- Ajustar o prompt: em vez de "use null quando nada fizer sentido", exigir sempre uma categoria + campo `confidence: "high" | "medium" | "low"`.
- Aceitar apenas sugestões `high`/`medium` no cliente; `low` continua caindo em "Sem categoria" para revisão manual.
- Manter validação de match exato/normalizado contra a árvore existente (não inventar categoria nova).
- Trocar modelo de `google/gemini-2.5-pro` para `google/gemini-3.6-flash` (mais barato e rápido, suficiente para classificação).

Efeito: cobertura maior sem contaminar a base com chutes ruins — o usuário ainda revisa antes de salvar.

### 3) Nenhuma mudança em `ImportStatementModal.tsx`

O modal já aplica `SuggestionSource` via `resolveCategoryPath` e expande hierarquia. Continua funcionando com o novo formato.

## Validação

- Rebuild automático do Vite.
- Pedir ao usuário para reimportar o mesmo PDF (ou um novo extrato) no contexto Eva e checar quantas linhas vêm pré-categorizadas.
- Consulta rápida no banco após o import para medir a taxa (`count(*) filter (where category <> 'Sem Categoria')`).

## Fora de escopo

- Ampliar janela de histórico além de 6 meses.
- Persistir "aprendizado" em tabela dedicada — o histórico de `transactions` já cumpre esse papel.
- Mudar o modelo do Estágio 2 para outro provider.
