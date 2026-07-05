## Problema

No modal "Faturamento por competência", cada parcela de boleto aparece como um lançamento separado, e o cálculo de MDR fica absurdo (ex.: Julia Rinaldi 9/9 → Bruto R$ 5.500,00, MDR -R$ 4.937,50, Líquido R$ 562,50).

Causa raiz: quando uma venda é parcelada, o campo `original_amount` é gravado em **cada** parcela com o **valor total da venda** (R$ 5.500), enquanto `amount` é o valor da parcela (R$ 562,50). Hoje o modal calcula `fee = original_amount − amount` linha a linha, o que infla o MDR e conta a mesma venda N vezes.

Cartão aparece correto porque as parcelas de cartão/terminal já são gravadas com `original_amount` proporcional à parcela (MDR é aplicado por parcela).

## Solução (apenas no modal, sem tocar em dados nem em outras telas)

Agrupar as parcelas da mesma venda (`series_id` igual) em **uma única linha** representando a venda inteira.

### Regra de agregação por `series_id`

Para cada grupo de parcelas com o mesmo `series_id` (quando `series_id` não é nulo):

- **Bruto da venda** = `max(original_amount)` do grupo (todas as parcelas têm o mesmo `original_amount` = total da venda). Se `original_amount` vier nulo/zero, cai em `Σ amount`.
- **Líquido da venda** = `Σ amount` de todas as parcelas do grupo.
- **MDR da venda** = `Bruto − Líquido` (nunca negativo; se der ≤ 0, mostra "—").
- **Descrição** = descrição da primeira parcela, com sufixo `(Nx)` onde N = `installments_total` (ou tamanho do grupo).
- **Competência / Pagamento** = data da **primeira** parcela (menor `installment_number`).
- **Status** = "Pago" se todas as parcelas pagas; senão "Parcial" (badge) ou "Pendente" se nenhuma paga.
- **Categoria / Contato** = da primeira parcela.
- Contagem `count` do grupo = 1 venda (não N parcelas).

Lançamentos **sem** `series_id` (venda à vista/boleto único) continuam como linha única, com a mesma fórmula atual (`gross = original_amount ?? amount`, `fee = gross − net`).

### Impacto nas visões

- **Aba Lista**: mostra 1 linha por venda (não por parcela). Ticket médio passa a refletir vendas, não parcelas.
- **Totais (Bruto / MDR / Líquido / % efetivo)**: recalculados a partir das vendas agregadas — corrige o MDR inflado.
- **Por mês / Por categoria / Por cliente**: agregam sobre as vendas já consolidadas (competência da 1ª parcela define o mês da venda).
- **Contagem "lançamentos"** vira "vendas".
- Botão "Ver todos os lançamentos do período" continua indo para `/lancamentos` com os filtros atuais (lá o usuário vê parcela a parcela, comportamento esperado).

## Arquivo alterado

`src/components/dashboard/FaturamentoDetailModal.tsx`

1. Estender o tipo `Tx` local com `series_id`, `installment_number`, `installments_total` (já presentes em `competenceTransactions`, só precisa expor).
2. Antes de calcular `lines`, criar `sales`: agrupar `receitas` por `series_id` (ou `id` quando `series_id` nulo) aplicando as regras acima.
3. Substituir o uso de `lines` (mapeado 1:1 das receitas) por `sales` em: totais, paginação da Lista, `groupBy`, `byMonth`, `byCategory`, `byContact`.
4. Ajustar renderização da coluna "Descrição" para mostrar o sufixo `(Nx)` quando for venda parcelada, e um badge "Parcial" quando o status agregado for misto.
5. Manter o helper `r2` em todas as somas para preservar precisão de 2 casas.

Nenhuma alteração em hooks, banco, edição, criação, ou em outras telas. Apenas apresentação do modal.
