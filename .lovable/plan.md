## Diagnóstico

Revisando o modal de Faturamento à luz do print, encontrei **duas causas raízes**:

### 1. Cálculo do Bruto/MDR agregado por série (bug principal)

`original_amount` é gravado com **semânticas diferentes** dependendo do meio de pagamento:

- **Cartão (maquininha)**: cada parcela guarda o **próprio bruto** proporcional (ex.: venda R$ 300 em 3x → cada parcela tem `original_amount = 100`, `amount = 90`).
- **Boleto / parcelamento manual**: cada parcela guarda o **valor total da venda** (ex.: R$ 5.500 em 9x → cada parcela tem `original_amount = 5500`, `amount = 611,11`).

Hoje a agregação usa `max(original_amount)` para todas as séries. Isso funciona para boleto (por acaso o MDR já é anulado pelo `isCard=false`), mas **quebra em cartão parcelado**: `max` retorna o bruto de UMA parcela, e o "líquido" é a soma de N parcelas → `fee` fica negativo (`hasGross` cai) e a venda **some do total de MDR**. Resultado: o card superior "MDR (Taxas)" e "Bruto" ficam menores do que a soma da lista.

**Correção**: detectar o padrão automaticamente:

- Se `max(original_amount) >= sum(amount) - 0,01` → padrão boleto: `gross = max(original_amount)` (uma parcela já traz o total).
- Caso contrário → padrão maquininha: `gross = sum(original_amount)` (soma parcelas).

Isso reproduz os dois casos corretamente:

| Caso | max(oa) | sum(oa) | sum(amount) | Regra | Gross |
|---|---|---|---|---|---|
| Cartão 3x R$300 | 100 | 300 | 270 | sum | 300 ✓ |
| Boleto 9x R$5500 | 5500 | 49500 | 5500 | max | 5500 ✓ |
| Venda simples cartão | 107,16 | 107,16 | 100 | sum | 107,16 ✓ |

### 2. Pendentes "sumindo" em alguns contextos

Verifiquei o fetch (`fetchCompetenceTransactions` em `useDashboardData.ts`): **não há filtro por `status`** — pendentes vêm do banco. O sumiço reportado é, na prática, efeito colateral do bug #1: quando a série pendente é cartão parcelado, `hasGross` fica false, `fee`=0 e a venda aparece na Lista mas com totais errados. Ao corrigir #1, pendentes voltam a aparecer com Bruto/MDR/Líquido corretos.

Adicionalmente vou **garantir que o cálculo de vendas pendentes seja incluído** em todas as agregações (Lista, Por mês, Por categoria, Por cliente) e no card "vs anterior" — hoje já é, mas quero re-verificar após o fix.

### 3. Sanidade — bater totais com a lista

Vou adicionar uma verificação implícita: os cards de resumo (Bruto/MDR/Líquido) usarão os mesmos `filteredLines` que alimentam a Lista, garantindo que a soma da coluna == valor do card.

## Escopo do fix

Arquivo único: `src/components/dashboard/FaturamentoDetailModal.tsx`

1. Trocar a lógica de `rawGross` pela heurística `max vs sum(amount)`.
2. Manter `hasGross = isCard && rawGross > net + 0.01` (só cartão pode ter MDR).
3. Adicionar um teste manual mental: quando `paymentFilter === "credito"` ou `"debito"`, o card MDR do topo deve ser exatamente `Σ fee` das linhas visíveis; quando `"all"`, o MDR do topo deve ser exatamente `Σ fee` das vendas cartão (não card contribui zero).
4. Confirmar que pendentes contam para Bruto/Líquido em todos os agrupamentos.

Sem alterações em banco, hooks, ou outras telas.
