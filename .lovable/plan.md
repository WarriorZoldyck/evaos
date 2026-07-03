## Resposta curta

**Não batem garantido — por 3 motivos de design diferentes entre os dois hooks.** Posso corrigir.

## Diagnóstico

Comparei `useDashboardData.ts` (campo `faturamento`) com `useDREData.ts` (Receita Bruta).

| Aspecto | Dashboard `faturamento` | DRE Gerencial | DRE Contábil |
|---|---|---|---|
| Base de data | `competence_date` ✓ | `competence_date` ✓ | `competence_date` ✓ |
| Status | Pago + Pendente ✓ | Pago + Pendente ✓ | Pago + Pendente ✓ |
| Exclui transferência interna | `is_internal_transfer=false` | `is_internal_transfer=false` **+** `category ilike 'transfer%'` | idem Gerencial |
| Filtro por mapeamento contábil | **Nenhum** — soma toda receita | Nenhum | **Só categorias com `dre_section` preenchido** |
| Tratamento de não-mapeadas | Conta | Conta | **Ignora silenciosamente** (vira `unmappedCategoryCount`) |

### Onde divergem

1. **Faturamento (dash) ≠ Receita Op. Bruta (DRE Contábil)** sempre que existir receita em categoria sem `dre_section`. É o caso mais comum hoje (várias categorias herdadas sem mapeamento).
2. **Faturamento (dash) ≠ Receita Gerencial** se houver categoria com nome começando por "transfer"/"transferência" que **não** esteja marcada como `is_internal_transfer=true` (legado pré-flag).
3. Dashboard não filtra categorias "transfer%" por nome — então transferências antigas sem flag inflam o faturamento.

## Plano de correção

### 1. Unificar regra de exclusão de transferências
Em `useDashboardData.ts`, replicar o filtro do DRE: adicionar `.not("category","ilike","transfer%")` e `.not("category","ilike","transferência%")` nas queries `transactions` e `competenceTransactions`. Garante que dashboard e DRE Gerencial usem exatamente o mesmo universo de linhas.

### 2. Expor as duas leituras no card "Faturamento"
Em `SummaryCards.tsx` (card Faturamento), trocar o número único por:
- **Faturamento Bruto** (toda receita por competência) — bate com DRE Gerencial.
- **Receita Operacional** (só categorias mapeadas) — bate com DRE Contábil "(+) Receita Operacional Bruta".
- Badge com contagem de categorias não classificadas e link "Mapear no DRE" → leva pra tela de categorias com o filtro de não-mapeadas.

Calcular ambos dentro de `useDashboardData.ts` reaproveitando `categories.dre_section` (já há fetch de categorias em outros pontos; senão, adiciono um fetch leve).

### 3. Tooltip educativo
Tooltip no card explicando: "Faturamento Bruto = todas as receitas do período (regime de competência). Receita Operacional = subconjunto mapeado para o DRE Contábil."

### 4. Validação
Após o ajuste, rodar query de sanity em 2-3 usuários ativos (`espclin`, `sabrina`, `renato`) e comparar:
- `SUM(amount) WHERE type='receita' AND competence_date BETWEEN ...` (dashboard)
- mesmo valor agrupado por `dre_section` (DRE Contábil)
- diff esperado = receita em categorias sem mapeamento.

## Arquivos afetados

- `src/hooks/useDashboardData.ts` — adicionar filtro `transfer%`, novo cálculo `receitaOperacional`, fetch de categorias.
- `src/components/dashboard/SummaryCards.tsx` — exibir Bruto + Operacional + badge de não-mapeadas.
- (opcional) `src/pages/Categories.tsx` — receber query param `?unmapped=1` pra filtrar.

Nenhuma mudança de schema. Nenhuma alteração de dados.
