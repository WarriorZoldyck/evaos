

## Correção do Dashboard: Entrada Prevista + Saída Prevista

### Problema 1: Entrada Prevista calculando errado

**Causa raiz:** O cálculo atual usa `competenceTransactions` (filtradas por `competence_date`) para calcular o previsto e o consolidado. O correto, conforme a definição do sistema, e o que faz mais sentido pro usuario, e calcular como: **total de receitas Pendentes no periodo** (por data de pagamento).

**Correção:** Entrada Prevista = soma de todas as transacoes do tipo "receita" com status "Pendente" no periodo (filtradas por `payment_date`, que ja estao no array `transactions`).

### Problema 2: Saída Prevista ausente

Adicionar um novo card "Saida Prevista" seguindo a mesma logica: soma de todas as transacoes do tipo "despesa" com status "Pendente" no periodo.

---

### Alteracoes

**Arquivo 1: `src/hooks/useDashboardData.ts`**
- Alterar o calculo de `entradaPrevista` para: soma de `transactions` onde `type === "receita"` e `status === "Pendente"`
- Adicionar calculo de `saidaPrevista`: soma de `transactions` onde `type === "despesa"` e `status === "Pendente"`
- Adicionar `saidaPrevista` ao objeto `summary` retornado

**Arquivo 2: `src/components/dashboard/SummaryCards.tsx`**
- Adicionar prop `saidaPrevista` ao componente
- Adicionar o 6o card "Saida Prevista" com icone `Clock`, trend "neutral" e gradiente destrutivo
- Ajustar o grid de 5 para 6 colunas (`lg:grid-cols-6`)

**Arquivo 3: `src/pages/Dashboard.tsx`**
- Passar `saidaPrevista` para o componente `SummaryCards`

---

### Detalhes Tecnicos

```text
ANTES (errado):
  entradaPrevista = competenceTransactions(receita, todas) - competenceTransactions(receita, Pago)

DEPOIS (correto):
  entradaPrevista = transactions.filter(receita + Pendente).sum(amount)
  saidaPrevista   = transactions.filter(despesa + Pendente).sum(amount)
```

Os arrays `transactions` ja estao filtrados por `payment_date` dentro do periodo selecionado e pelo filtro de conta, entao o calculo fica simples e correto.

