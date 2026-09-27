# Pagar Fatura: valor errado ao abrir

## O que acontece
Ao abrir "Pagar Fatura", a janela mostra primeiro os dados da abertura anterior (ou do mês atual) e só depois busca o mês certo. As duas buscas correm juntas e, se a antiga termina por último, ela sobrescreve o valor certo. Além disso, a limpeza feita na abertura pode apagar o valor sugerido e ele não é preenchido de novo. Por isso é preciso fechar e abrir outra vez.

## Correção (só na janela Pagar Fatura)
1. Ao abrir: limpar a lista e o total anteriores e mostrar "carregando" até o mês certo ser definido.
2. Buscar os lançamentos só depois de saber o mês certo, e descartar respostas de buscas antigas (a última busca pedida é a que vale).
3. Preencher o valor sugerido depois da limpeza de abertura, para ele nunca ficar vazio ou velho.
4. Ao fechar: zerar mês, lista e valor, para a próxima abertura começar limpa.

## Detalhes técnicos
- `CreditCardBillPaymentModal.tsx`: estado `monthReady` (false ao abrir, true após `initialReferenceDate` ou `pickInitialMonth`); `fetchBill` só roda com `monthReady`.
- Flag `cancelled`/contador de requisição no `useEffect` de `fetchBill` e `pickInitialMonth`, com cleanup.
- `setBillTransactions([])` + `setLoadingBill(true)` na abertura; sync de `paymentAmount` depende de `[pendingTotal, open, loadingBill]`.
- Confirmar com Playwright abrindo e reabrindo a janela em meses diferentes.
