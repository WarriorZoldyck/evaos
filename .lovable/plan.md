## Diagnóstico

O número não bate por construção, não por bug:

- **Lançamentos** soma TODOS os lançamentos pendentes do cartão visíveis no filtro atual, independente da fatura (no print: 26 lançamentos / R$ 5.333,71 — mistura compras de 09/02, 14/02, 16/02, 22/02, 01/03, 09/03 e 21/03).
- **Modal Pagar Fatura** soma apenas o ciclo da fatura escolhida (fechamento ~28 e vencimento 09/03 → 25 itens / R$ 4.979,28). A diferença de R$ 354,43 é o lançamento "Aéreo curso Tchelo 2/2" que cai em outro ciclo, e o "Facebook 21/03 R$ 2.416,27" pertence à fatura seguinte.

O modal já abre no ciclo da compra pendente mais antiga (correção anterior), mas o usuário esperava ver o mesmo total mostrado em Lançamentos.

## O que fazer

Tornar a relação Lançamentos ↔ Fatura explícita, para que os números sempre batam.

### 1. Subagrupar o cartão em Lançamentos por fatura

Em `src/components/lancamentos/TransactionTable.tsx`, na montagem do `CardGroupItem`:

- Para cada cartão (e cada filho na hierarquia), em vez de um único grupo com todas as pendências, dividir os lançamentos em **subgrupos por ciclo de fatura** usando `closing_day` (mesma função `getBillingCycleDates` usada pelo modal).
- Cada subgrupo vira uma linha "VISA Azul • Fatura 09/03/2026 • 25 lanç. — R$ 4.979,28" com seu próprio botão **Pagar Fatura** que abre o modal já posicionado nesse ciclo.
- Lançamentos já realizados continuam agrupados normalmente (sem botão de pagar).

Assim o total exibido em cada linha é exatamente igual ao "Total da Fatura" do modal correspondente.

### 2. Modal abre no ciclo solicitado

Em `src/components/contas/CreditCardBillPaymentModal.tsx`:

- Aceitar uma prop opcional `initialReferenceDate?: Date`.
- Quando recebida, usar essa data como `referenceDate` inicial em vez do `useEffect` que busca o "earliest pending". O comportamento atual (auto-pick do mais antigo) continua valendo quando a prop não é passada (ex.: header "Pagar Fatura" global).

### 3. Passar a data do ciclo ao abrir o modal

Em `src/pages/Lancamentos.tsx`:

- `billPaymentCard` vira `{ card, referenceDate? }`.
- Os handlers em `onLiquidate` / `onViewDetails` para cartão passam o `competence_date` do lançamento clicado (modal abre na fatura daquele lançamento, não na mais antiga aleatória).
- O novo botão "Pagar Fatura" do subgrupo passa a data do ciclo daquele subgrupo.

### Detalhes técnicos

- Reutilizar `getBillingCycleDates(closing_day, refDate)` exportando-a (ou movendo para `src/lib/`).
- Chave do subgrupo: `${cardId}::${yyyy-mm do cycleEnd}`.
- Ordenação dos subgrupos: por `cycleEnd` ascendente (faturas mais antigas no topo, casa com a ordem visual atual).
- Hierarquia parent/child: aplicar o subagrupamento dentro de cada nó (parent próprio + cada filho), preservando a UI existente.
- Não alterar nenhuma lógica de pagamento, RLS, edge functions ou cálculo do bill. Mudança puramente de apresentação + roteamento de prop.

## Resultado

- Cada linha de cartão em Lançamentos mostra exatamente o total de uma fatura.
- Clicar em "Pagar Fatura" (no header do subgrupo ou em "Liquidar" num lançamento) abre o modal já no mês correto, com o mesmo valor.
- Sem mais divergência entre tela e modal.
