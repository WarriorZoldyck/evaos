## Objetivo

Trazer a experiência de fechamento/conciliação para o padrão BPO (Omie/Conta Azul): sinalização visual clara de fatura **paga** e **conciliada** na lista de lançamentos, preservação do estado conciliado após reimportação, trava de **mês conciliado** por fatura, e filtro global de conciliação. Tudo aditivo — nenhum fluxo atual quebra.

## 1. Ícones "Paga" e "Conciliada" no cabeçalho da fatura

No `CardGroupHeader` (row de cada `MASTERCARD BLACK • Fatura jul/2026`) — hoje só aparece total, contador e "Pagar Fatura". Passa a exibir dois badges derivados das transações do ciclo:

- **✓ Paga** (verde) — quando `pendingCount === 0` (todas as tx do ciclo estão `status='Pago'`).
- **🔗 Conciliada** (azul) — quando todas as tx do ciclo têm `is_reconciled = true`.
- **⚠ Parcial** (âmbar, discreto) — X/Y conciliadas quando misto (opcional, só se houver espaço).

O botão "Pagar Fatura" some quando `Paga`. Se `Paga && Conciliada`, o header ganha um leve tint verde e ícone `ShieldCheck`. Nada muda para faturas em aberto.

## 2. Importação preserva conciliação existente

- **Já implementado no back-end** (`ImportStatementModal.tsx:828` grava `is_reconciled: true` ao vincular). Auditar para garantir que **nenhum caminho** de vinculação/rematch faça `is_reconciled: false` implícito.
- **UI**: no `ReconcileStep`, quando o candidato do sistema já vem com `is_reconciled=true`, exibir badge "já conciliado" e mudar copy do botão de "Vincular" para "Reafirmar vínculo" (não altera comportamento — só transparência).
- Reforçar copy no topo da conciliação: *"A importação bate SISTEMA × BANCO. Ela nunca duplica um lançamento já conciliado."*

## 3. Trava "Mês conciliado" por fatura (fechamento)

**Ação nova** no `CardGroupHeader` (menu `⋯` ao lado de "Pagar Fatura"): **"Fechar mês (conciliado)"**.

Comportamento:

- Ao fechar: cria registro em nova tabela `public.closed_bill_cycles` (`user_id`, `credit_card_id`, `cycle_key`, `closed_at`, `closed_by`, `note`).
- Trigger `trg_block_closed_bill_cycle` em `transactions` (BEFORE INSERT/UPDATE/DELETE): se `credit_card_id + cycle_key(payment_date)` estiver fechado, `RAISE EXCEPTION 'Fatura fechada em dd/mm/yyyy. Reabra para editar.'`.
- Cabeçalho passa a mostrar cadeado 🔒 + "Mês conciliado — {data} por {usuário}".
- Ações da fatura (Pagar, Editar, Excluir, Ignorar) ficam desabilitadas com tooltip "Fatura fechada — reabra para editar".
- Botão **"Reabrir mês"** no mesmo menu ⋯ (com confirmação) remove o registro.
- Aviso amarelo em banner no topo do grupo quando fechado: *"Este mês está fechado. Nenhum lançamento pode entrar ou sair até reabrir."*

Aplica-se também a **contas bancárias** (mesma lógica, chave por `bank_account_id + YYYY-MM` do `payment_date`) — mas escopo inicial deste plano é **cartão**; conta fica na fase 2 se você validar a UX.

## 4. Filtro "Conciliados" / "Sem conciliação"

- Novo campo em `TransactionFilters`: `reconciled: 'todos' | 'sim' | 'nao'` (default `todos`).
- Novo ToggleGroup na barra de filtros, ao lado do ToggleGroup de status: **Todos · Conciliados · Sem conciliação**.
- Query em `useTransactions` aplica `.eq('is_reconciled', true/false)` conforme seleção.
- Persistência no localStorage junto dos outros filtros.

## O que NÃO muda

- Nenhuma transação é migrada. Cálculos de saldo e DRE seguem iguais.
- Fluxo do modal "Pagar Fatura" continua o mesmo — só passa a refletir "Paga" no header ao terminar.
- Matcher wave A/B/C intocado.

## Detalhes técnicos

- **Migration**: `closed_bill_cycles` (id, user_id, credit_card_id nullable, bank_account_id nullable, cycle_key text, closed_at timestamptz default now, closed_by uuid, note text, unique(user_id, credit_card_id, cycle_key), unique(user_id, bank_account_id, cycle_key)); RLS `user_id = auth.uid()` + workspace helper; GRANTs para `authenticated` e `service_role`.
- **Trigger** `check_closed_bill_cycle()` em `public.transactions` calcula `cycle_key` via mesma fórmula do `getCycleInfo` (função SQL `public.compute_cycle_key(payment_date, closing_day, due_day)` reaproveitando lógica atual) e bloqueia se houver linha correspondente em `closed_bill_cycles`.
- **Front**: `useClosedCycles(cardIds)` hook + prop no `CardGroupHeader` (`closed: boolean`, `closedAt`, `onClose`, `onReopen`). Novo componente `<BillStatusBadges paga conciliada fechada />`.
- **Filtro**: extender `TransactionFilters` (interface + estado + query) e adicionar controle na `TransactionFilters.tsx`.
- **UX mobile**: badges viram ícones-only com tooltip; menu ⋯ agrupa "Fechar/Reabrir mês".
