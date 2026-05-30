Plano para corrigir o fluxo de faturas em Lançamentos:

1. Unificar a lógica de ciclo de fatura
- Criar/usar uma única regra para cartão: a fatura deve ser identificada pelo mês de vencimento/pagamento da parcela, não pela data de competência original da compra.
- Para compras parceladas, cada parcela deve entrar somente na fatura do seu próprio `payment_date`/vencimento.
- Evitar que o modal some todas as parcelas de uma mesma compra/série quando o usuário abriu apenas uma fatura.

2. Corrigir o modal “Pagar Fatura”
- Alterar a busca do modal para filtrar por `credit_card_id`, status/ciclo e principalmente pelo intervalo correto de `payment_date` da fatura selecionada.
- Manter o modal abrindo no mês/ciclo que veio da linha clicada em Lançamentos.
- No exemplo do Mastercard Black, o modal deve trazer somente os lançamentos da fatura selecionada e bater com os R$ 8.722,12, não R$ 24.092,59.

3. Corrigir o agrupamento da tabela de Lançamentos
- Ajustar o agrupamento dos cartões para usar a mesma base do modal.
- Remover o comportamento que transforma grupo com apenas 1 lançamento em “lançamento solto”; mesmo com 1 item, se for cartão/fatura, deve continuar como linha de fatura quando isso for necessário para consistência visual.
- Garantir que o botão “Pagar Fatura” da linha agrupada envie explicitamente a referência do ciclo, sem depender de escolher a primeira transação do grupo.

4. Corrigir o filtro mensal de datas
- Revisar `useTransactions` para que o filtro “Abril 2026” não traga faturas fora do período selecionado por causa de busca exaustiva de pendentes ou agrupamento posterior.
- O filtro mensal deve respeitar o campo que representa o vencimento/projeção exibido na tela (`payment_date`) e não reaproveitar lançamentos de março/maio no resultado de abril.

5. Validar o fluxo crítico
- Conferir nos arquivos `TransactionTable.tsx`, `CreditCardBillPaymentModal.tsx`, `Lancamentos.tsx` e `useTransactions.ts` se a mesma regra está sendo aplicada de ponta a ponta.
- Validar especialmente compras parceladas, cartões pai/filho, faturas com apenas 1 lançamento e filtro mensal em Projetado.