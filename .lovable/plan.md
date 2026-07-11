## Navegação de faturas + acesso direto ao pagamento no Dashboard

Além das setas ‹ › para alternar entre **fatura anterior / atual / próxima** em cada cartão do Dashboard, adicionar um atalho que abre a **fatura já filtrada no ciclo selecionado**, permitindo revisar e pagar sem sair do Dashboard.

### UX

- Em cada `CreditCard3D`, um mini-controle com setas + label do ciclo (ex.: `‹ Fatura atual · Nov/25 ›`).
- Logo abaixo do valor de uso, um botão discreto **"Ver / Pagar fatura"** (ícone `Receipt` + texto). Clique abre o modal de fatura já posicionado no ciclo selecionado.
- Setas e botão usam `e.stopPropagation()` para não disparar o flip 3D.
- Estado do ciclo é por-cartão, default = "atual". Limite -1..+1.

### Fluxo de "Ver / Pagar fatura"

Reaproveitar componentes já existentes — não criar tela nova:

1. `CreditCardBillPaymentModal` (`src/components/contas/CreditCardBillPaymentModal.tsx`) já implementa listagem de itens da fatura de um cartão + fluxo de pagamento (parcial/total/sobra). Vamos abri-lo diretamente do Dashboard.
2. O modal aceita/precisa saber qual **ciclo** exibir. Se hoje ele só mostra a fatura em aberto, adicionar props opcionais `initialCycleKey?: string` (formato `YYYY-MM`, mesmo formato usado por `compute_cycle_key` e `useClosedCycles`) e — se o modal já tiver navegação interna de mês — apenas pré-selecionar; caso contrário, filtrar as transações exibidas por `payment_date` dentro do mês do ciclo.
3. Botão "Ver / Pagar fatura" no card chama um handler no `DashboardCreditCardsRow` que seta `{ cardId, cycleKey }` e abre o modal.

### Lógica de ciclos (igual ao plano anterior)

- Ciclo de uma transação = mês do `payment_date`.
- Valor exibido no cartão = soma `despesa − receita` das transações do cartão no mês do ciclo (sem filtrar por `status`, para faturas passadas/futuras aparecerem corretamente).
- "Atual" = mês corrente; offset -1 = anterior; +1 = próxima.

### Arquivos afetados

- `src/components/dashboard/DashboardCreditCardsRow.tsx`
  - Agregar transações por `(cardId, YYYY-MM do payment_date)`.
  - Estado `cycleOffsetByCard: Record<string, -1|0|1>` e `billModal: { cardId, cycleKey } | null`.
  - Passar props novos ao `CreditCard3D`: `cycleLabel`, `onPrevCycle`, `onNextCycle`, `canPrev`, `canNext`, `onOpenBill`.
  - Renderizar `<CreditCardBillPaymentModal>` controlado pelo estado `billModal`, passando `initialCycleKey`.
- `src/components/contas/CreditCard3D.tsx`
  - Props novos (todos opcionais, retrocompatível): navegação de ciclo + `onOpenBill`.
  - Bloco com setas + label do ciclo e botão "Ver / Pagar fatura" (ícone `Receipt`), com `stopPropagation`.
- `src/components/contas/CreditCardBillPaymentModal.tsx`
  - Aceitar `initialCycleKey?: string` e usar como filtro/seleção inicial do mês da fatura.
  - Se já houver seletor de mês interno, apenas inicializar com esse valor; caso contrário, aplicar filtro `payment_date` no intervalo do mês.
  - Sem mudanças na lógica de pagamento em si.

### Fora de escopo

- Não altera `useDashboardData`, `useClosedCycles`, cálculo de MDR, DRE ou projeções.
- Não muda a página `/contas` nem os cards fora do Dashboard.
- Fechamento/reabertura de ciclo continua exclusivo da tela de contas.
