
## Diagnóstico (dados reais do banco)

Consultei `public.transactions` do usuário `espclin@hotmail.com` (id `b049592f…`). O que encontrei nas últimas 24h explica exatamente o que ele está vendo:

1. **A última importação foi salva quase sem categoria.** Nos dois lotes do cartão "TESTE" (`37a27fc6…`) de 23/07: 111 de 115 (22:29) e 54 de 135 (23:16) ficaram com `category = 'Sem Categoria'`. Ou seja: **os lançamentos até estão gravados no banco, mas sem a categoria** — não foi conciliação perdida, foi conciliação salva vazia.
2. **O histórico existe e é forte**, só que fica em descrições diferentes. Exemplos:
   - Novo: `DROGASIL 3066`, `DROGASIL 1424 03/03` → sem categoria. Histórico: `DROGASIL 3066 SAÚDE RIO VERDE`, `Compra na Drogasil` → **Saúde / Farmácias** (várias vezes).
   - Novo: `LEMOS TAVARES LTDA 02/02` → sem categoria. Histórico: mesmo fornecedor já existe (aparece como `LEMOS TAVARES LTDA`) em outros lançamentos.
   - Novo: `NETFLIX COM` → um foi como "Assinatura anual", outros como "Sem Categoria" no mesmo lote.
3. **O campo `category` está misturando texto e UUID** (252 texto vs 16 UUID no lote). Isso quebra o `byId`/`byName` na próxima importação: uma linha histórica com `category = 'Saúde'` bate por nome, mas outra com UUID de outro contexto que ficou órfão não bate por nada.
4. **Descrições novas trazem sufixos `NN/NN`, prefixos `IOF Internacional -`, códigos de loja (`3066`, `1424`, `L13`)** — a normalização atual não remove tudo isso, então `Layer 0` (chave idêntica) quase nunca casa.

Conclusão honesta: os dados estão no banco. O que falta é (a) **backfill milimétrico** das categorias faltantes usando o próprio histórico do usuário e (b) fechar as brechas da normalização/matching que causaram o vazio, para a próxima importação já vir preenchida.

## Plano

### 1. Backfill preciso das categorizações faltantes (somente esse usuário)
- Script one-off (migration SQL rodada uma vez, escopo `user_id = b049592f…`) que:
  1. Monta um dicionário `descrição normalizada → (category_id, subcategory_id, subcategory2_id)` a partir do próprio histórico do usuário (`public.transactions` + `public.ai_pending_transactions`), ignorando linhas cuja categoria é `Sem Categoria`/vazia e resolvendo nomes-texto contra `public.categories` do mesmo `user_id`.
  2. Normaliza tirando: sufixo de parcela (`\s\d{1,2}/\d{1,2}$`), prefixo `IOF Internacional -`, tokens numéricos com 3+ dígitos, prefixos `MP*`, `PG *`, `SPAY *`, `AMAZON MARKETPLACE...` (só o "AMAZON"), acentos e pontuação.
  3. Casa em cascata: **idêntico → prefixo de 8 caracteres → primeiro token relevante do comerciante (ex.: `DROGASIL`, `NETFLIX`, `LEMOS TAVARES`)**.
  4. `UPDATE` só onde `category IN ('Sem Categoria','')` OU `category IS NULL`, gravando **UUIDs** (nunca texto) e preservando `subcategory`/`subcategory2` quando existirem no histórico. `updated_at = now()`. Sem tocar em linhas já categorizadas.
- Retorno mostra: X linhas atualizadas, Y sem match (para eu listar caso a caso).

### 2. Padronizar `category` em UUID nas linhas já texto (mesmo usuário)
- Segundo `UPDATE` converte `category` texto → UUID quando existe categoria com esse `name` no `public.categories` daquele `user_id`/contexto correto. Idem para `subcategory`/`subcategory2`. Isso faz com que a próxima importação use `byId` e não dependa de `byName`.

### 3. Corrigir a matching-source para próximas importações
Em `src/hooks/useCategorySuggestions.ts`:
- Ampliar `normalize()` para remover sufixo de parcela, prefixo `IOF Internacional -`, adquirentes (`MP*`, `PG *`, `SPAY *`, `AMAZONMKTPLC*`, `PPRO*`), tokens numéricos (≥3 dígitos) e o sufixo isolado depois do último espaço quando for número puro.
- Nova **Layer 1.5 (merchant-token)**: chave = primeiro token alfabético de 4+ letras (`DROGASIL`, `NETFLIX`, `LEMOS`). Só entra se houver ≥2 amostras votando na mesma categoria e nenhuma delas for `Sem Categoria`.
- Ignorar amostras com `category = 'Sem Categoria'` ou vazio em todas as camadas — hoje elas viram voto "sem categoria" e mascaram o histórico bom.

### 4. Verificação
- Após o backfill, rodo uma query final e reporto: quantas linhas do lote de 23/07 ficaram com categoria real, e mostro 20 exemplos de antes/depois.
- Aí o usuário refaz a importação do MESMO extrato num cartão de teste e conferimos que agora aparece "X de Y do seu histórico" alto — sem cruzar dados de outro usuário (todas as queries continuam `eq('user_id', …)`).

## Detalhes técnicos (para revisão)

- Backfill via `supabase--migration` com `UPDATE public.transactions ... WHERE user_id = 'b049592f-d97a-468d-a839-ed02c2a41d9b' AND ...` — nenhum outro usuário é tocado.
- Nenhuma alteração de RLS, tabela, trigger ou coluna.
- IA continua desligada — a memória `constraints/data-security-rls` e a decisão anterior de usar somente histórico são preservadas.
- O front (`ImportStatementModal` + `CategoryPathCombobox`) já sabe consumir UUIDs, então padronizar em UUID resolve o vazamento visto antes.

## O que NÃO vou fazer
- Não vou inventar categoria para linhas que o próprio histórico do usuário não justifica — elas ficam como `Sem Categoria` para ele decidir.
- Não vou mexer em lançamentos que já tinham categoria (nem para "melhorar").
- Não vou tocar em nenhum outro `user_id`.
