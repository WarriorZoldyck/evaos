## Diagnóstico

Não é bug do DRE — o banco tem **categorias raiz duplicadas** para o usuário `espclin@hotmail.com`:

| Nome | Ids raiz | Transações | Filhas |
|---|---|---|---|
| Alimentação | `5d8a0810` (mantém) + `bb42d231` | 245 vs 0 | 10 + 3 |
| Bancárias | `ff059430` (mantém) + `5f7fdefe` ("bancárias") | 52 vs 25 | 5 + 3 |
| Educação | `a41fdf31` (mantém) + `5025e3cd` + `1833b0b4` | 22 vs 11 vs 2 | 5 + 2 + 1 |
| Vestuário | `115f74f8` (mantém) + `b78fc3fd` + `2c1aaaf6` | 27 vs 5 vs 0 | 2 + 1 + 1 |

As subcategorias legítimas sob outros pais (`Férias > Alimentação`, `Viagens > Alimentação`, `PESSOAIS > Educação`, `DESPESAS CLÍNICA PF > Vestuário`) **não** são duplicatas e ficam intactas.

O DRE renderiza cada `category.id` como uma linha própria, então elas aparecem repetidas na tela. Nenhum dado se perde ao mesclar — só é preciso reapontar transações e filhas antes de apagar as raízes duplicadas.

## Correção (uma migração de dados, sem alterar schema)

Ordem estrita para **não perder nenhuma transação nem subcategoria**:

### 1. Reapontar transações
Para cada raiz duplicada `dup_id → keep_id` (Alimentação, Bancárias, Educação, Vestuário), atualizar `transactions.category`, `transactions.subcategory`, `transactions.subcategory2`, `recurring_transactions.*` e `ai_pending_transactions.*` quando forem iguais ao `dup_id`. Filtrado por `user_id = espclin`.

### 2. Reapontar filhas sem conflito de nome
Filhas do `dup_id` cujo nome **não** existe sob o `keep_id`: mover `parent_id` para o `keep_id`.
- Alimentação: `Panificadora`, `Restaurante`, `Supermercado`
- Educação: `Cursos`, `Cursos presenciais`, `Livros`
- Vestuário: `Uniformes`

### 3. Mesclar filhas com conflito de nome
Filhas do `dup_id` cujo nome **já existe** sob o `keep_id`: reapontar transações dessas filhas duplicadas para a filha correspondente sob o `keep_id`, mover netos (se houver), depois apagar a filha duplicada.
- Bancárias: `Empréstimos`, `Juros`, `Tarifas` (3 conflitos)
- Vestuário: `Roupas`

### 4. Apagar as raízes duplicadas
Só depois de 1–3 concluídos. Se `SELECT count(*) FROM transactions WHERE category/subcategory/subcategory2 = dup_id` for zero **e** `SELECT count(*) FROM categories WHERE parent_id = dup_id` for zero, `DELETE`.

### 5. Normalizar caixa dos nomes
`UPDATE categories SET name='Bancárias' WHERE id='5f7fdefe...'` já foi deletado no passo 4; para `vestuário` (115f74f8, o keeper) atualizar `name='Vestuário'`.

## Segurança e verificação

- Rodar tudo em uma única transação (`BEGIN … COMMIT`) via `supabase--insert` para poder rollback se algo der errado.
- Antes do `DELETE`, um `SELECT` de verificação garante que nenhuma referência restou.
- Contagem de transações totais do usuário antes e depois deve bater exatamente.

## Prevenção futura (opcional, decidir depois)

Uma constraint `UNIQUE (user_id, lower(name), parent_id)` em `categories` impediria novas duplicatas. Mas isso é mudança de schema e pode quebrar imports existentes — proponho **não** aplicar agora; primeiro corrigir os dados do usuário afetado. Se quiser blindar depois, aviso.

## Escopo

Somente o usuário `espclin@hotmail.com`. Nenhum outro usuário é tocado. Nenhum código de aplicação muda — a UI já está correta, o problema é 100% dado.
