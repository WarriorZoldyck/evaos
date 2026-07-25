## Objetivo

1. Remover o prefixo `⚠️ [CORREÇÃO EVA — CONFERIR]` dos títulos das transações — o usuário simoespaula já conferiu tudo (153 lançamentos afetados, exclusivo desse user).
2. Consolidar o aprendizado global: para cada usuário, aplicar as categorias já definidas manualmente nos lançamentos ainda sem categoria com o mesmo estabelecimento normalizado.

## Passo 1 — Limpar títulos (SQL)

```sql
UPDATE public.transactions
SET description = trim(regexp_replace(description, '^⚠️\s*\[CORREÇÃO EVA — CONFERIR\]\s*', ''))
WHERE description LIKE '⚠️ [CORREÇÃO EVA — CONFERIR]%';
```

Mesma limpeza em `ai_pending_transactions` (caso existam pendências com o mesmo prefixo).

## Passo 2 — Backfill global de categorias

Para cada usuário, montar um dicionário `estabelecimento_normalizado → category_id` a partir das transações do próprio usuário (últimos 24 meses) já categorizadas, priorizando a categoria mais profunda/mais frequente. Aplicar em transações do mesmo usuário sem `category_id`.

Regras de segurança:
- Estritamente escopado por `user_id` (nunca cruza usuários).
- Só preenche onde `category_id IS NULL`.
- Normalização igual à do `useCategorySuggestions` (uppercase, remove parcelas `01/03`, prefixos de adquirentes, stopwords).
- Um único statement SQL com CTE + `UPDATE ... FROM`.

## Passo 3 — Verificação

- Contagem de linhas afetadas por passo.
- Amostra de 10 títulos do simoespaula antes/depois.
- Total de transações sem categoria por usuário antes/depois.

## Detalhes técnicos

- Executado via migration única (idempotente — o `LIKE` do passo 1 não bate após rodar; o passo 2 só age em `category_id IS NULL`).
- Nenhuma alteração de schema, RLS ou código frontend.
- Não altera `bank_account_id`, `credit_card_id`, valor ou data — apenas `description` (passo 1) e `category_id` (passo 2).