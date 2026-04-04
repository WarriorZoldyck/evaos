

# Auditoria: Dashboard vs DRE vs Plano de Caixa

## Diagnóstico dos dados reais (Abril/2026)

Consultei diretamente o banco de dados para os 4 usuários ativos no período. Resultado:

### Usuário principal (b049592f — maior volume, 100 transações em abril)

| Visão | Entradas | Saídas | Observação |
|-------|----------|--------|------------|
| **Dashboard** | R$ 15.580,94 | R$ 4.947,59 | payment_date, status=Pago |
| **Plano de Caixa** | R$ 15.580,94 | R$ 4.947,59 | payment_date, status=Pago, sem transferências |
| **DRE** | R$ 3.000,00 | R$ 12.369,79 | competence_date, todos os status, sem transferências |

Dashboard e Plano de Caixa **batem perfeitamente** no banco. A DRE é diferente **por design** (competência vs caixa, e inclui pendentes).

### Os outros 3 usuários: mesma situação — Dashboard = Caixa nos dados reais.

## Então por que parece não bater?

Identifiquei **3 problemas reais no código** que podem causar discrepâncias visuais:

### 1. Dashboard filtra categorias por empresa; Caixa e DRE não
- **Dashboard** (linha 184-191): `categories` filtrado por `company_id`
- **Caixa** (linha 49): `categories` sem filtro de empresa (busca TODAS)
- **DRE** (linha 78): `categories` sem filtro de empresa (busca TODAS)

**Impacto**: No Dashboard, se uma transação usa uma categoria de outra empresa, o nome não resolve → aparece como UUID ou nome errado no gráfico de categorias. Nos relatórios, aparece correto. Isso causa **diferença visual** nos totais por categoria.

### 2. Dashboard não exclui transferências; Caixa e DRE excluem
- **Dashboard** (linhas 233-237): query SEM `.is("transfer_id", null)`
- **Caixa** (linha 78): `.is("transfer_id", null)`
- **DRE** (linha 103): `.is("transfer_id", null)`

**Impacto**: Hoje os dados não têm transferências em abril, então não há diferença. Mas se um usuário criar transferências entre contas, o Dashboard vai inflar entradas E saídas (conta a transferência como receita numa conta e despesa na outra), enquanto Caixa e DRE não.

### 3. Dashboard não pagina; Caixa e DRE paginam
- **Dashboard**: usa `.order()` simples, sujeito ao limite de 1000 linhas do Supabase
- **Caixa/DRE**: fazem paginação com `.range()`

**Impacto**: Hoje nenhum usuário tem >500 transações/mês, então não é problema imediato. Mas quando crescer, o Dashboard vai truncar dados silenciosamente.

## Plano de correção

### Arquivo: `src/hooks/useDashboardData.ts`

**Correção 1 — Excluir transferências do Dashboard**
Adicionar `.is("transfer_id", null)` nas 3 queries (transactions, competenceTransactions, allTransactions). Isso alinha com Caixa e DRE.

**Correção 2 — Buscar todas as categorias (sem filtro de empresa)**
Mudar `fetchCategories` para buscar sem filtro de `company_id`, igual ao DRE e Caixa. Assim a resolução de nomes fica consistente.

**Correção 3 — Adicionar paginação**
Implementar a mesma lógica de paginação com `.range()` usada no Caixa e DRE para as queries de transactions e competenceTransactions.

## Resultado esperado

Após as correções:
- Dashboard Entradas/Saídas = Plano de Caixa (mesmo regime, mesmos filtros)
- DRE continua diferente por design (competência vs caixa)
- Categorias resolvidas igualmente nas 3 visões
- Sem risco de truncamento por limite de 1000 linhas

## Detalhes técnicos

| Local | Mudança |
|-------|---------|
| `useDashboardData.ts` ~linha 236 | Adicionar `.is("transfer_id", null)` na query principal |
| `useDashboardData.ts` ~linha 259 | Adicionar `.is("transfer_id", null)` na query de competência |
| `useDashboardData.ts` ~linha 290 | Adicionar `.is("transfer_id", null)` na query de projeção |
| `useDashboardData.ts` ~linhas 183-191 | Remover filtro de `company_id` na busca de categorias |
| `useDashboardData.ts` ~linhas 230-252 | Adicionar paginação `.range()` |

