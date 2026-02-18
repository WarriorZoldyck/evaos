

## Correção da Projeção de Saldo e Consistência dos Cards

### Problemas Identificados

**1. Duplicidade de recorrentes na projeção**
A projeção soma transações futuras reais (`allTransactions`) + ocorrências virtuais de recorrentes (`recurringOccurrences`) sem verificar se a recorrente já foi materializada como transação real. Isso causa valores duplicados.

**2. Transações futuras "Pagas" inflam a projeção**
O filtro `futureTransactions` (linha 440) não distingue status -- inclui tanto "Pago" quanto "Pendente". Uma transação futura já marcada como "Pago" é contada no saldo inicial (`paidBefore` filtra `payment_date <= today`) E novamente na projeção futura se `payment_date > today`. Isso não acontece hoje porque `paidBefore` usa `<= today`, mas transações com data futura e status "Pago" podem surgir (ex: agendamentos liquidados antecipadamente).

**3. Filtro de conta inconsistente nos saldos iniciais**
Quando `accountId` está definido, o `walletSum` é zerado (linha 216), mas as transações de carteira continuam sendo incluídas em `allTransactions` (a query filtra apenas por `bank_account_id`). Isso distorce o saldo.

**4. O gráfico achata no longo prazo**
Com "Ano todo" selecionado, a projeção só considera transações já cadastradas e recorrentes de 90 dias. Após esse horizonte, o saldo fica "flat" até dezembro -- dando impressão de estabilidade falsa.

---

### Correções Propostas

Arquivo modificado: `src/hooks/useDashboardData.ts`

**Correção A -- Deduplicar recorrentes**
Antes de adicionar ocorrências virtuais à projeção, filtrar as que já possuem transação real correspondente (mesmo `description` + `payment_date` + `amount`), evitando contagem dupla.

**Correção B -- Separar futuros por status**
Na projeção, tratar transações futuras "Pago" como certas e "Pendente" como projetadas. Ambas entram no saldo, mas transações futuras "Pago" não devem ser contadas no `paidBefore` (que deve filtrar `payment_date <= today`). Verificar que a fronteira está correta.

**Correção C -- Consistência do filtro de conta**
Quando `accountId` está ativo, garantir que `allTransactions` também exclua transações de carteiras (`wallet_id`) que não pertencem à conta filtrada.

**Correção D -- Indicador visual de horizonte de projeção**
Adicionar uma linha vertical tracejada ou mudança de opacidade no gráfico para indicar onde terminam os dados reais e começa a projeção sem dados (área "flat"). Isso dá contexto visual ao usuário.

---

### Detalhes Técnicos

```text
Fluxo corrigido da projeção:

1. currentBalance = initialBalances + SUM(transações pagas com payment_date <= hoje)
2. futureTransactions = transações com payment_date > hoje E payment_date <= futureEnd
3. futureRecurring = ocorrências virtuais NO MESMO intervalo, EXCLUINDO as que já existem como transação real
4. Para cada dia no intervalo:
   - runningBalance += soma do dia (futureTransactions + futureRecurring)
   - gerar ponto no gráfico
```

Mudanças no código (todas em `useDashboardData.ts`):

- Linhas 426-433: Garantir que `paidBefore` filtra estritamente `payment_date <= today` E `status === "Pago"` (já faz isso -- OK)
- Linhas 440-442: Manter futureTransactions sem filtro de status (projeção inclui tudo futuro)  
- Linhas 453-461: Adicionar deduplicação -- criar um Set de chaves `${payment_date}_${amount}_${description}` das transações reais e pular recorrentes que colidem
- Linha 216: Quando `accountId` ativo, filtrar também `allTransactions` para excluir wallet_id

Arquivo modificado: `src/components/dashboard/BalanceProjectionChart.tsx`
- Adicionar `ReferenceLine` vertical no dia de hoje para separar visualmente "realizado" de "projetado"

### Impacto
- Zero alteração no banco de dados
- Não afeta outros componentes (cards, categorias, etc.)
- Os cards de sumário estão corretos (Entradas - Saídas = Saldo do Período confere)
