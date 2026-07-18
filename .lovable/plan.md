## Diagnóstico

Os logs da edge function `parse-bank-statement` mostram três chamadas recentes retornando **401 Unauthorized** (em 2026-07-18, ~11:17–11:18) — nenhuma delas chegou a executar código do parser, o rejeite acontece na camada de gateway do Supabase antes da função rodar.

Causa: a função `parse-bank-statement` **não está declarada** em `supabase/config.toml`. Todas as outras funções do projeto que precisam ser chamadas pelo app (ex.: `eva-chat`, `pluggy-webhook`, `whatsapp-webhook`, `evolution-webhook-config` etc.) estão listadas ali com `verify_jwt = false`. Sem essa entrada, o novo sistema de signing keys do Supabase rejeita o JWT do usuário no gateway e devolve 401 antes de chegar em `serve()`.

Isso explica por que o modal de importação (`ImportStatementModal.tsx` → `supabase.functions.invoke('parse-bank-statement', ...)`) falha para os usuários mesmo estando logados.

## Correção

Adicionar a função em `supabase/config.toml`:

```toml
[functions.parse-bank-statement]
  verify_jwt = false
```

A função continua segura porque:
- só faz parsing do texto/arquivo enviado (não escreve no banco);
- não expõe dados de outros usuários (a persistência dos lançamentos importados é feita depois, no cliente, com o JWT do usuário via RLS).

## Verificação pós-deploy

1. Refazer uma importação de OFX/CSV pelo modal de Lançamentos → Importar.
2. Confirmar em `function_edge_logs` que a nova chamada retorna 200 (não 401).
