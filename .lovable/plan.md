## Diagnóstico

### 1. Card "Faturamento" no Dashboard mostra o líquido, não o bruto
Em `src/hooks/useDashboardData.ts` (linha 406), `faturamento` é calculado como `Σ t.amount` sobre as receitas por competência. Para vendas em cartão, `t.amount` já é a fração **líquida** (após MDR); o valor **bruto** vive em `t.original_amount`. Por isso o card mostra R$ 25.712,55 (líquido) e o modal mostra R$ 26.666,00 (bruto) — o card está errado.

### 2. Onde está o lançamento de ~R$ 12.000
Ele **não sumiu** — continua na lista. O contador diz "7 vendas" (linha 368 do modal usa `count = filteredLines.length`) e a tabela é rolável (`ScrollArea h-[45vh]`). No screenshot só 5 linhas cabem visíveis; as outras 2 (incluindo a de R$ 11–12k do Claudio) estão abaixo do fold. A soma das 5 visíveis (R$ 15.616) + as 2 ocultas fecha nos R$ 26.666.

Ou seja: nada foi filtrado indevidamente pela mudança de "Por cliente/contato" → "Por cliente" (aquela mudança só afeta a aba de agrupamento, não a Lista). Vou confirmar isso no build reordenando as colunas para que a linha do Claudio fique explicitamente identificável (com cliente + descrição + contato visíveis lado a lado).

## Correções

### A. `src/hooks/useDashboardData.ts` — Faturamento bruto real
Trocar o cálculo de `faturamento` para usar a mesma lógica per-item do modal:

```ts
// para cada receita por competência:
//   se é cartão E original_amount > amount → soma original_amount (bruto)
//   senão → soma amount
```

Vou reusar helpers `isCardItem`/`classifyItem` (extrair para `src/lib/paymentKind.ts` para não duplicar). Também vou passar a expor `faturamentoLiquido` para métricas que já dependiam do net (nenhuma até onde vi — o "MDR pago no mês" já usa `mdrBruto/mdrLiquido/mdrTaxas` próprios). A "Margem" (linha ~) usa `faturamento` como denominador; mudar para bruto é mais correto contabilmente (margem sobre receita bruta).

### B. `FaturamentoDetailModal.tsx` — Lista com colunas reordenadas
Nova ordem de colunas da aba **Lista** (uma linha por venda, como hoje):

```
Cliente | Descrição | Contato | Competência | Pagamento | Categoria | Forma | Bruto | MDR | Líquido
```

- **Cliente** = `contact_name || description` (mesmo fallback usado em "Por cliente"), truncado, negrito. Sem contato explícito, herda da descrição.
- **Descrição** = descrição original + badge de parcelas (2x, 3x) + badge de status (Pendente/Parcial).
- **Contato** = `contact_name || "—"` (mostra "—" quando o cliente veio da descrição).
- **Forma** = badge com `KIND_LABEL[primaryKind]` (crédito/débito/boleto/…/Misto).
- Bruto/MDR só aparecem se `hasAnyMdr`.
- Datas ficam em fonte menor no meio (menos peso visual).

### C. Aba "Por cliente" — adicionar Qtd e %
Adicionar colunas `Qtd` (vendas) e `%` (participação sobre `totals.gross`) na tabela agrupada por cliente, ordenada por bruto desc. Mesmo tratamento nas outras abas agregadas (Por mês, Por categoria) para consistência.

## Verificação
1. Abrir modal em Jun/2026 → conferir se o lançamento do Claudio aparece na Lista, com Cliente = "Claudio…" / Contato visível separadamente.
2. Conferir Dashboard: card Faturamento deve bater com `Bruto` do modal (R$ 26.666,00 no exemplo).
3. Conferir soma da coluna Bruto na Lista == card Bruto do modal == card Faturamento do Dashboard.

## Fora de escopo
Não mexo em hooks de MDR (`mdrBruto/mdrLiquido`), em `SummaryCards` layout, nem em outras telas.
