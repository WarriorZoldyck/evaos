## Objetivo

No modal de Faturamento por competência: (1) só mostrar MDR quando a venda for cartão (crédito/débito), (2) permitir clicar na linha para ver todas as parcelas + dados relevantes, (3) adicionar filtro por forma de pagamento.

## 1. MDR só para cartão

`src/hooks/useDashboardData.ts` — incluir `card_terminal_id` e `payment_method` no `.select(...)` das queries `competenceTransactions` e `transactions` (linhas 264 e 292).

`src/components/dashboard/FaturamentoDetailModal.tsx`:
- Adicionar `card_terminal_id?: string | null` e `payment_method?: string | null` no tipo `Tx`.
- Helper `isCardPayment(items)`: `true` quando **qualquer** parcela tem `card_terminal_id` não nulo **ou** `payment_method` normalizado ∈ { `credito`, `debito`, `credit_card`, `debit_card`, `cartao_credito`, `cartao_debito`, `cartao` }.
- Na agregação `lines`, só habilitar `hasGross = isCardPayment(items) && rawGross > 0 && rawGross > net`. Caso contrário `gross = net`, `fee = 0`, coluna MDR/Bruto = "—".
- Totais, `% MDR efetivo` e agrupamentos passam a refletir só vendas realmente com MDR.

## 2. Clique na linha → detalhes da venda

- Adicionar estado `selectedSale` no modal.
- Cada `<tr>` da aba Lista fica clicável (`cursor-pointer`) e abre um sub-dialog `SaleDetailDialog`.
- O sub-dialog mostra:
  - Cabeçalho: descrição da venda, contato, categoria (resolvida), forma de pagamento, badge do status agregado.
  - Cards resumo: Bruto, MDR (só se cartão), Líquido, nº de parcelas.
  - Tabela de parcelas: `#`, competência, pagamento, status (Pago/Pendente), valor da parcela. Ordenadas por `installment_number`.
  - Botão "Abrir na tela de Lançamentos" que navega para `/lancamentos?series_id=<id>` (usa filtro já existente por descrição/série se disponível — senão passa `dateFrom/dateTo` da venda como fallback).
- Para vendas não parceladas (série única), o dialog abre com uma única linha e sem seção de "parcelas".

## 3. Filtro por forma de pagamento

- Novo controle acima das abas: `Select` com opções: **Todas**, **Cartão de crédito**, **Cartão de débito**, **Boleto**, **PIX**, **Dinheiro**, **Transferência**, **Outros**.
- Normalização flexível de `payment_method` (mesmo dicionário do item 1) + fallback: se qualquer parcela tem `card_terminal_id`, classifica como "Cartão" (crédito por padrão, débito só se `payment_method` indicar).
- Filtro aplica-se ao array `lines` **após** a agregação — todas as visões (Lista, Por mês, Por categoria, Por cliente, cards de resumo) são recalculadas com base no subset filtrado.
- Estado persiste enquanto o modal está aberto; reseta ao fechar.

## Arquivos alterados

- `src/hooks/useDashboardData.ts` — expandir `.select`.
- `src/components/dashboard/FaturamentoDetailModal.tsx` — MDR condicional, filtro de forma de pagamento, sub-dialog de detalhes com lista de parcelas.

Nenhuma alteração em banco de dados, edição, criação, WhatsApp ou outras telas.
