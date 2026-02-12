
## Auditoria Completa do EVA OS - Correcoes Encontradas

Apos revisar todos os arquivos criticos do aplicativo, identifiquei os seguintes problemas que precisam ser corrigidos:

---

### PROBLEMA 1: Dashboard nao recarrega dados apos liquidar
O `refreshKey` em `Dashboard.tsx` (linha 26) e incrementado ao liquidar, mas nunca e passado para `useDashboardData`. Os dados ficam obsoletos apos liquidacao no dashboard.

**Correcao:** Passar `refreshKey` como dependencia ou chamar refetch apos liquidacao.

---

### PROBLEMA 2: Projecao "Ano todo" nao inclui janeiro (inicio do ano)
A projecao comeca em `today` (Fev/2026) e vai ate `endOfYear`. Se o usuario quer ver o ano todo incluindo janeiro, a logica esta correta para PROJECAO futura, mas o label "Ano todo" pode confundir. A projecao so pode ir do presente em diante, entao janeiro ja passou e nao faz sentido projetar o passado. O label esta adequado.

**Veredicto:** OK, mas o grafico precisa incluir dados historicos do inicio do ano ate hoje para dar contexto. Atualmente, a projecao comeca com o saldo de hoje e projeta para frente, sem mostrar como chegou ali.

---

### PROBLEMA 3: Filtro por conta nao filtra cartoes de credito
Na query de `useDashboardData.ts` (linhas 160-162), o filtro `accountId` filtra por `bank_account_id`. Porem, transacoes de cartao de credito nao tem `bank_account_id` preenchido - elas tem `credit_card_id`. Ao filtrar por conta, todas as transacoes de cartao somem do dashboard.

**Correcao:** Quando uma conta e selecionada, tambem incluir transacoes cujo cartao de credito esta vinculado a essa conta (via `credit_cards.bank_account_id`).

---

### PROBLEMA 4: "Entrada Prevista" usa competencia vs caixa de fontes diferentes
O calculo `previstoReceitas` vem de `competenceTransactions` (filtrado por `competence_date`), enquanto `consolidadoReceitas` vem de `transactions` (filtrado por `payment_date`). Isso pode gerar inconsistencias onde `previsto - consolidado` fica negativo ou incorreto, porque uma transacao pode ter competencia em fevereiro mas pagamento em marco.

**Correcao:** Usar a mesma base para ambos. O previsto deve ser baseado em transacoes com `competence_date` no periodo, e o consolidado deve ser as mesmas transacoes que ja foram pagas (status = "Pago"), nao as que tem `payment_date` no periodo.

---

### PROBLEMA 5: Grafico de categorias nao inclui link para lancamentos com filtro correto
Em `CategorySummaryCharts.tsx` (linha 38), o filtro usa `category=${category.name}`. Porem, em `Lancamentos.tsx` (linha 67-70), a busca compara `c.name === categoryParam && !c.parent_id`. O `useTransactions` filtra por `categoryId` (UUID), nao por nome. Isso funciona parcialmente: encontra a categoria por nome, pega o UUID, e filtra. Mas se houver categorias com nomes duplicados entre Pessoal e Empresa, pode pegar a errada.

**Correcao:** Passar o UUID diretamente no query param em vez do nome.

---

### PROBLEMA 6: `allTransactions` sem limite pode trazer muitos dados
Em `useDashboardData.ts` (linhas 200-227), `allTransactions` busca TODAS as transacoes do usuario sem filtro de data e sem `.limit()`. Se o usuario tem milhares de transacoes, isso pode causar lentidao e ate bater no limite de 1000 rows do Supabase.

**Correcao:** Adicionar `.limit(1000)` e/ou filtrar por um range razoavel (ex: ultimos 2 anos).

---

### PROBLEMA 7: Cascata de categorias - state stale apos criar
Em `CategorySelectWithCreate.tsx`, apos criar uma nova categoria, `onCategoryCreated(data.id)` e chamado. No `TransactionFormModal.tsx`, isso aciona `fetchFormCategories()` e `field.onChange(newId)`. O problema: `fetchFormCategories` e async e `field.onChange(newId)` pode executar antes do fetch terminar. Quando o fetch retorna, `subCategories` e recalculado com base no `watchCategory`, mas se o `newId` e um UUID que acabou de ser criado, pode nao estar na lista ainda.

**Correcao:** Garantir que `field.onChange(newId)` so execute APOS o `await onCategoryCreated()` completar. Verificar que o fluxo em cascata ja faz `await` corretamente (linhas 1104-1108 mostram que faz `await onCategoryCreated()` primeiro, depois `field.onChange(newId)` - isso esta correto).

**Veredicto:** A implementacao atual ja usa `await` antes do `onChange`. OK.

---

### PROBLEMA 8: Categorias no grafico usam nome como chave, nao UUID
Em `useDashboardData.ts` (linhas 287-316), categorias sao agrupadas por `t.category`. Mas `t.category` pode ser um UUID (se criado pelo novo sistema) ou um nome (dados legados). Se houver mix, a mesma categoria pode aparecer duas vezes no grafico.

**Veredicto:** O sistema ja tem lookup por UUID/nome nos outros componentes. O dashboard deveria resolver nomes antes de agrupar.

**Correcao:** Resolver o nome da categoria antes de agrupar, usando o mesmo lookup que `TransactionTable` usa.

---

### PROBLEMA 9: Fatura de cartao - agrupamento ignora conta do usuario
Em `UpcomingTransactions.tsx`, transacoes de cartao de credito sao agrupadas por `credit_card_id` e `billingMonth`. O `bankAccountId` da fatura vem de `card.bank_account_id`. Isso esta correto.

**Veredicto:** OK.

---

### PROBLEMA 10: Projecao nao inclui saldo inicial das contas bancarias
A projecao comeca com `currentBalance = soma de todas as transacoes pagas ate hoje`. Mas nao inclui o `initial_balance` das contas bancarias. O saldo real do usuario e `sum(initial_balance) + sum(transacoes pagas)`.

**Correcao:** Buscar `initial_balance` de todas as contas bancarias (e wallets) e somar ao saldo inicial da projecao.

---

## Resumo das Correcoes Necessarias

| # | Problema | Severidade | Arquivo |
|---|----------|-----------|---------|
| 1 | Dashboard nao recarrega apos liquidar | Alta | `Dashboard.tsx`, `useDashboardData.ts` |
| 3 | Filtro por conta ignora cartoes | Media | `useDashboardData.ts` |
| 4 | Entrada Prevista inconsistente | Alta | `useDashboardData.ts` |
| 6 | Query sem limite pode travar | Media | `useDashboardData.ts` |
| 8 | Categorias UUID vs nome no grafico | Media | `useDashboardData.ts` |
| 10 | Projecao ignora saldo inicial | Alta | `useDashboardData.ts` |

---

## Plano de Implementacao

### Etapa 1: Corrigir `useDashboardData.ts` (hub central)

1. **Refetch apos liquidacao**: Adicionar funcao `refetch` que re-executa todas as queries. Expor no retorno do hook. Chamar em `Dashboard.tsx` via `handleLiquidated`.

2. **Entrada Prevista consistente**: Calcular `consolidadoReceitas` a partir de `competenceTransactions` filtradas por `status === "Pago"` (mesma base que previsto), em vez de usar `transactions` (caixa).

3. **Saldo inicial na projecao**: Buscar `initial_balance` de `bank_accounts` (e `wallets`), somar ao `currentBalance` da projecao.

4. **Limite na query de allTransactions**: Filtrar por `payment_date >= inicio do ano atual - 1 ano` para limitar dados e evitar bater no limite de 1000.

5. **Filtro por conta incluindo cartoes**: Quando `accountId` esta setado, buscar os `credit_card_id`s vinculados a essa conta e incluir na query com `.or()`.

6. **Resolver nomes de categorias no grafico**: Buscar categorias e fazer lookup de UUID para nome antes de agrupar.

### Etapa 2: Dashboard.tsx
- Conectar `refetch` do hook ao `handleLiquidated`

### Etapa 3: CategorySummaryCharts.tsx
- Passar UUID no query param em vez do nome (minor)

---

### Detalhes Tecnicos

**Entrada Prevista corrigida:**
```
// Antes (inconsistente):
const previstoReceitas = competenceTransactions.filter(t => t.type === "receita").reduce(...)
const consolidadoReceitas = entradas; // <- vem de payment_date, nao competence_date

// Depois (consistente):
const previstoReceitas = competenceTransactions.filter(t => t.type === "receita").reduce(...)
const consolidadoReceitas = competenceTransactions.filter(t => t.type === "receita" && t.status === "Pago").reduce(...)
```

**Saldo inicial na projecao:**
```
// Buscar no useEffect:
const { data: accounts } = await supabase
  .from("bank_accounts")
  .select("initial_balance")
  .filter_by_company...

const initialBalance = accounts?.reduce((sum, a) => sum + Number(a.initial_balance), 0) || 0;

// Na projecao:
let currentBalance = initialBalance + paidBefore.reduce(...)
```

**Filtro por conta incluindo cartoes:**
```
// Buscar credit_cards vinculados a conta
const linkedCardIds = creditCards
  .filter(c => c.bank_account_id === accountId)
  .map(c => c.id);

// Na query:
if (accountId) {
  if (linkedCardIds.length > 0) {
    query = query.or(`bank_account_id.eq.${accountId},credit_card_id.in.(${linkedCardIds.join(',')})`);
  } else {
    query = query.eq("bank_account_id", accountId);
  }
}
```
