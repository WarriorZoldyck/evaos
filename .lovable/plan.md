## Objetivo
Deixar o Fluxo de Caixa preciso e sem "fantasmas" para todos os usuários — sem duplicatas de categoria, sem linhas de UUID cru, sem hooks mortos — e alinhar o cálculo entre contextos (Pessoal/Empresa/consolidado).

## Diagnóstico (confirmado via SQL e leitura de código)

**Dados sujos em vários usuários** (mesmo padrão do espclin já corrigido):
- **Raízes duplicadas** (mesmo nome, ID diferente) em: `denise-pereira`, `erikafmatos`, `espclin` (restantes), `renatobruggemann`, `sabrinadomingues04`, `simoespaula`, `vitor_fernandes_rv`. Ex.: 4× "Honorários", 3× "SALÁRIOS/Salários".
- **Subcategorias duplicadas** sob o mesmo pai: `erikafmatos` (Alimentação), `espclin` (Store, Iof).
- **Variantes só de caixa** (mesmo nome com maiúsculas diferentes) espalhadas: `ADMINISTRATIVOS`/`Administrativos`, `Casa`/`casa`, `Aluguel`/`aluguel` etc.
- **Referências órfãs em `transactions.category`/`subcategory`/`subcategory2`**: 14+ UUIDs apontam para categorias inexistentes (usuários `vanessateixeirarmv`, `sabrinadomingues04`).

**Bugs em `useCashFlowMonthly.ts` / `useCashFlowData.ts`:**
1. `buildChain` cai no fallback `[{ id: category, name: category }]` quando o valor é um UUID inexistente → renderiza linha com UUID cru como nome.
2. `resolveName` cria nó sintético para qualquer texto não resolvido — texto "Alimentação" (legado) e uma categoria "Alimentação" (UUID) viram duas linhas separadas.
3. Case-only ("Salários" vs "SALÁRIOS") produz duas linhas na árvore.
4. `.select("… ${dateField} …")` interpolado explode tipos do supabase-js; deve usar helper `sel()` conforme a regra do repo.
5. Paginação reusa o mesmo builder e chama `.range()` em loop — funciona por acidente; blindar chamando range em builder fresh a cada página.
6. `useCashFlowData.ts` inteiro é **hook fantasma** — nenhum call site (`grep useCashFlowData(` retorna zero). Só o tipo `CategoryGroup` é importado em `CategoryReportTable`.

## Alterações

### 1. Correção de dados (migração/inserts, preservando tudo)
Executar por SQL, para **cada usuário** listado acima:
- Normalizar `categories.name`: `trim` + capitalização canônica (primeira ocorrência com case "Title Case-like" fica).
- Mesclar **raízes duplicadas**: escolher keeper (mais antiga), reapontar `transactions.category/subcategory/subcategory2`, `recurring_transactions.*` e `ai_pending_transactions.*` para o keeper; reparentar filhos; resolver conflitos de nome nos filhos antes de deletar dups; deletar dups.
- Mesclar **subcategorias duplicadas** sob mesmo pai (mesma lógica).
- Sanear **órfãs**: onde `transactions.category` é UUID inexistente, pôr `NULL` (a UI passará a mostrar em "Sem categoria"). O mesmo para `subcategory`/`subcategory2`.
- Rodar migração em bloco `DO $$ … $$` com verificações defensivas (aborta se restar filho apontando para dup ou transação referenciando dup).

### 2. `src/hooks/useCashFlowMonthly.ts`
- Trocar chave da árvore de `id` para **`lower(name)`** quando o item foi resolvido por nome (evita split case-only e texto-vs-UUID).
- `resolveName`: quando não resolver, retornar `null` (nunca `{ id: value, name: value }`).
- `buildChain`: se nada for resolvido, retornar `[{ id: "__sem_categoria__", name: "Sem categoria" }]` (bucket único).
- Adicionar `sel()` helper (`const sel = (s: string): string => s`) e tipar `.returns<Row[]>()`, seguindo `query-builder-type-performance`.
- Paginação: recriar builder por página (`buildBaseQuery()` retorna novo builder) para eliminar reuso frágil.
- Manter `splitContextNeutralTransfers` (transferências entre contas do mesmo contexto continuam ocultas).

### 3. Limpeza de código morto (fantasmas)
- Remover `src/hooks/useCashFlowData.ts` (não usado).
- Mover o tipo `CategoryGroup` para `src/components/relatorios/CategoryReportTable.tsx` (único consumidor), ou para `src/types/reports.ts`. Atualizar o import.
- Rodar `rg` final para garantir zero referências a `useCashFlowData` e a "Plano de Caixa".

### 4. Validação pós-mudança
- `supabase--read_query` para reconfirmar: zero raízes duplicadas, zero subs duplicadas, zero refs órfãs.
- Abrir Fluxo de Caixa em Pessoal e Empresa (`espclin` de referência) e checar que:
  - Alimentação, Vestuário, Salários etc. aparecem uma única vez.
  - Nenhuma linha com UUID.
  - Nenhuma linha "Transferência" (todas com `transfer_id` são filtradas via `splitContextNeutralTransfers` quando ambos os lados estão no contexto).

## Fora de escopo
- DRE, Dashboard, Lançamentos: sem alterações (mesma família de bugs pode existir, mas o usuário pediu foco em Fluxo de Caixa).
- Regras de RLS, edge functions, autenticação.

## Detalhes técnicos (para revisão)

Chave da árvore no `useCashFlowMonthly`:
```text
key = cat.id (quando resolvido por UUID)
key = "name:" + lower(name) (quando resolvido só por nome ou fallback)
key = "__sem_categoria__" (quando nada resolve)
```
Isso garante que "SALÁRIOS", "Salários" e o UUID canônico caiam no mesmo nó.

Skeleton da migração (SQL, por usuário afetado):
```text
1. UPDATE categories SET name = trim(name)
2. Para cada grupo de dups (root ou sub): escolher keeper; UPDATE tx.category/subcategory/subcategory2 e recurring/ai_pending; UPDATE categories.parent_id (não-conflitantes); repetir para filhos-conflitantes; DELETE dups.
3. UPDATE tx.category = NULL onde value é UUID e não existe em categories.
4. ASSERT sem dups e sem órfãos, senão RAISE EXCEPTION.
```
