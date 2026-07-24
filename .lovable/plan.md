## Contexto (verificado agora no banco)

Confirmei duas coisas antes de escrever o plano:

1. **A UI já salva no banco.** Toda vez que o usuário categoriza — no formulário de lançamento, no passo de conciliação da importação, ou inline — o `useTransactions` executa `.from("transactions").update({ category, subcategory, subcategory2 })` e persiste o UUID. Ou seja: **o que o usuário faz na tela chega ao Supabase em tempo real** e fica disponível pra próxima importação cruzar.

2. **Havia legado sujo.** Rodei uma consulta e vi que muitos usuários têm lançamentos antigos com:
   - Categoria em **texto puro** (`"Saúde"`, `"Farmácias"`) em vez de UUID → o hook não consegue casar de forma limpa
   - Linhas salvas como `"Sem Categoria"` mesmo tendo histórico próprio disponível (foi o que aconteceu com `espclin@`)

O caso do `espclin@` já foi limpo. **A dúvida legítima que você levantou é: e o resto da base?**

## O que este plano faz

Rodar o **mesmo backfill que funcionou** para `espclin@`, mas para **todos os usuários**, com escopo estritamente isolado (`user_id`). Nenhum dado cruza entre pessoas.

### Passo 1 — Backfill global de "Sem Categoria" usando o próprio histórico

Para cada `user_id`:
- Normaliza descrições (mesma regex do hook: strip parcelas `03/03`, `IOF Internacional`, `AMAZONMKTPLC*`, códigos numéricos ≥3 dígitos, prefixos de adquirente `MP*` `PG*` `SPAY*`)
- Constrói dois dicionários **só com o histórico daquele usuário**:
  - `exact` → descrição normalizada idêntica
  - `merchant` → primeiro token significativo, exige ≥2 amostras concordantes pra evitar chute
- Atualiza `category / subcategory / subcategory2` das linhas atualmente em `"Sem Categoria"` que tiverem match

### Passo 2 — Padronização texto → UUID (global)

Para cada `user_id`, converte qualquer categoria salva como nome de texto (`"Saúde"`) para o UUID correspondente da tabela `public.categories` daquele mesmo usuário. Se o nome não bate com nenhuma categoria dele, deixa como está (não inventa).

### Passo 3 — Relatório de resultado

Uma consulta final devolvendo, por usuário: quantas linhas foram backfilladas, quantas foram padronizadas, e quantas continuam "Sem Categoria" por falta de histórico (essas são as que dependem do usuário categorizar 1x — comportamento esperado que você escolheu).

## O que este plano NÃO faz

- **Não mistura dados entre usuários.** Cada `UPDATE` é `WHERE user_id = X` e cruza só com o histórico do mesmo `X`.
- **Não inventa categoria.** Se o usuário nunca categorizou aquele comerciante, a linha continua "Sem Categoria" — é a política que você aprovou ("EVA aprende com 1 exemplo").
- **Não muda schema, RLS, edge functions nem código do frontend.** É só cirurgia em dados.
- **Não toca em `ai_pending_transactions`** (staging da IA, não é histórico consolidado).

## Como você valida

Depois de rodar, eu retorno:
- Total de linhas backfilladas por usuário (amostra dos top 10 mais impactados)
- Confirmação de que `espclin@` continua igual (já estava limpo)
- Um SELECT rápido pra confirmar que nenhum `user_id` recebeu categoria de outro

Se algo parecer estranho, é `UPDATE` — dá pra reverter pontualmente, mas o script só grava onde havia `NULL`/`"Sem Categoria"`/texto, então não sobrescreve escolha manual do usuário.

## Detalhes técnicos

- Executado via `supabase--insert` (2 statements SQL, sem migração de schema)
- Regex idêntica à que o hook `useCategorySuggestions.ts` agora usa — garante que o próximo import bate com o dado backfillado
- Merchant threshold = 2 amostras (mais conservador que Layer 0/1 do hook, pra não propagar erro em massa)
