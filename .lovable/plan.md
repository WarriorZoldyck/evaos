## Diagnóstico

### 1. MDR do Dashboard (bug crítico — reportado)

`src/hooks/useDashboardData.ts` calcula o MDR do card assim:

```ts
const mdrTransactions = paidTransactions.filter(
  (t) => t.original_amount && Number(t.original_amount) > 0
);
```

Três problemas, confirmados nos dados:

- **Não filtra por cartão.** No contexto **RENATO BRUGGEMANN** existe "Maria Luiza Cruvinel", `payment_method=Dinheiro`, sem `card_terminal_id`, `amount=3.000`, `original_amount=6.738` (o usuário registrou o valor total da venda parcelada em dinheiro). Isso vira **R$ 3.738 de MDR fantasma**. Somando padrões parecidos nos outros meses, chega aos R$ 10 mil reclamados.
- **Base é `payment_date`, não competência.** O modal de Faturamento agrega por `competence_date`. Em **IMPLANTES BR / EVA OS** (junho/2026), o valor real por competência é R$ 953,45 (R$ 702,29 Pago + R$ 251,16 Pendente). O card mostra R$ 819 por só pegar parcelas com `payment_date` em junho.
- **Só conta Pago.** MDR já está comprometido na venda; modal e DRE contam Pago + Pendente.

O DRE e o `useMdrSummary` já usam a regra correta. Bug isolado em `useDashboardData.ts`.

### 2. Receita Bruta do DRE ≠ Faturamento do Dashboard (reportado agora)

- **Dashboard Faturamento:** soma **todas** as receitas por competência (bruto via `itemGross`), independente de a categoria estar mapeada a centro de custo.
- **DRE "(+) Receita Operacional Bruta":** só soma receitas cuja categoria (ou ancestral) tem `dre_section` preenchido. Receitas sem mapeamento entram no banner "N categorias sem centro de custo" e ficam de fora da linha.

Enquanto houver receita sem mapeamento, a linha do DRE mostrará menos que o Faturamento. Para o usuário isso é inaceitável — "receita bruta = faturamento".

Correção: no DRE Contábil, toda receita não mapeada cai por padrão em **Receita Operacional Bruta**. Assim a linha bate exatamente com o card Faturamento em qualquer mês, e o banner de "categorias sem centro de custo" passa a contar apenas **despesas** sem mapeamento (que é o que realmente prejudica o resultado).

## Correções

### `src/hooks/useDashboardData.ts` — cálculo do MDR do summary

Substituir o bloco `mdrTransactions … mdrPercent … mdrCount` por:

- **Base:** `competenceTransactions.filter(t => t.type === "receita")` (mesma base do Faturamento, inclui Pago + Pendente).
- **Filtro:** `isCardPayment(t)` de `@/lib/paymentKind` **e** `Number(original_amount) > Number(amount)`.
- `mdrBruto = Σ original_amount`, `mdrLiquido = Σ amount`, `mdrTaxas = bruto − líquido`, `mdrPercent = taxas/bruto*100`.
- **Contagem "vendas":** agrupar por `series_id` (fallback `id`) para bater com o "14 vendas" do modal.

### `src/hooks/useDREData.ts` — receitas sem mapeamento vão para Receita Operacional

Dentro do `contabilData` useMemo, no loop `transactions.forEach`:

- Se `sectionKey` não resolveu **e** `t.type === "receita"`, forçar `sectionKey = "receita_operacional"` em vez de descartar.
- Só contar categorias em `unmappedCategoryIds` (que alimenta o banner) quando `t.type === "despesa"`.

A linha "Taxas de Maquininha (MDR)" em Despesas com Vendas continua igual (já usa a regra correta `isCardPayment + gross>net`).

## Resultado esperado

- Card **MDR no período** do Dashboard passa a bater exatamente com o "MDR (taxas)" do modal de Faturamento (ex.: R$ 953,45 em junho/EVA OS; R$ 0 em Renato).
- Linha **(+) Receita Operacional Bruta** do DRE Contábil passa a bater mês a mês com o card **Faturamento** do Dashboard.
- Banner amarelo do DRE só reclama de despesas sem centro de custo.

Sem migração no banco. Nenhuma outra tela precisa mudar.

## Arquivos

- `src/hooks/useDashboardData.ts`
- `src/hooks/useDREData.ts`
