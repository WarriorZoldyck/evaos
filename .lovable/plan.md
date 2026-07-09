## Objetivo

A busca do "lado sistema" na conciliação já está correta. O problema é de **transparência**: a Sabrina não consegue ver, na hora da conciliação, se o que o sistema tem bate exatamente com o que ela recebeu no extrato. Este plano ataca só isso + o alerta de órfãos + os dois botões simétricos de "manter só" — **sem quebrar nada do que já funciona**.

## Diagnóstico rápido dos dados da Sabrina

- **Santander (Pago):** 15 receitas (R$ 15.130,00) − 22 despesas (R$ 6.517,47) = **R$ 8.612,53**
- **Itaú PF (Pago):** 1 despesa (R$ 3.379,99) = **−R$ 3.379,99**
- **Órfãos Pagos (sem conta):** 8 despesas (R$ 4.935,61) + 2 receitas (R$ 900,01) → inflando o consolidado
- **Pendentes órfãos:** 98 despesas (R$ 24.868,85) → poluem relatórios

## O que muda na tela de conciliação (UX de transparência)

1. **Cabeçalho de resumo (novo)** — 3 números no topo:
   - `Total do extrato importado`
   - `Total do sistema no período` (pagos + pendentes da conta/cartão dentro das datas)
   - `Diferença` (verde se 0, vermelho caso contrário)

2. **Três buckets explícitos** com contagem e soma:
   - ✅ **Conciliados** (bateu extrato ↔ sistema)
   - ➕ **Só no extrato**
   - ⚠️ **Só no sistema**

3. **Ações simétricas por linha (novo — o pedido de agora):**

   | Bucket | Ação existente | Ação nova |
   |---|---|---|
   | Só no sistema | ✅ *"Manter só do sistema"* (já funciona) | — |
   | Só no extrato | ➕ *"Criar como novo lançamento"* (já funciona, exige conta destino) | ✅ **"Manter só do extrato"** (marca como aceito-sem-match: **não cria transação**, **não força vínculo**, sai da lista de pendências da conciliação e não volta a aparecer em importações futuras do mesmo arquivo) |

   Ambos os "Manter só" são **decisões conscientes** do usuário — o sistema registra que aquela linha/lançamento foi revisada e aceita como está. Nada é criado nem apagado.

4. **Aviso de escopo** discreto: "Mostrando lançamentos de *{conta}* entre *{data_ini}* e *{data_fim}*."

5. **Resumo final ao concluir**: *"Extrato R$ X · Sistema R$ Y · Diferença R$ Z"* + botão "Ver diferença".

## Como o "Manter só do extrato" funciona por baixo (sem quebrar nada)

- Reaproveita o mesmo mecanismo de "ignorar" que hoje o "Manter só do sistema" já usa (marca a linha como resolvida no estado local da conciliação e persiste o hash da linha do extrato em uma tabela leve `import_ignored_lines` — `user_id`, `bank_account_id`, `line_hash`, `reason`, `created_at`).
- Na próxima importação do mesmo extrato, o `useImportMatching` consulta esses hashes e já traz a linha marcada como "ignorada anteriormente" (usuário pode reverter).
- Fluxo de criação de transação existente **não é tocado** — o botão novo é uma alternativa ao "Criar como novo", não uma substituição.

## Alerta global de órfãos (só avisar, não corrigir)

1. **Card de alerta** no Dashboard e em Lançamentos quando existirem transações Pagas sem `bank_account_id`/`wallet_id`/`credit_card_id`/`transfer_id`:
   > "Você tem **N lançamentos sem conta vinculada** (R$ X). Enquanto não corrigir, o saldo do sistema pode divergir do saldo real."

2. **Tela "Lançamentos sem conta"** (`/lancamentos/sem-conta`):
   - Lista órfãos com filtros (status, tipo, período).
   - Por linha: **Vincular a conta/cartão/carteira**, **Excluir**, **Ignorar** (sai do alerta).
   - Ações em lote.

3. **Saldo consolidado do dashboard**: soma apenas lançamentos com `bank_account_id` ou `wallet_id`. Órfãos ficam fora do saldo até serem corrigidos.

## O que NÃO muda

- Nenhuma transação da Sabrina é alterada/apagada automaticamente.
- Matching wave A/B/C continua igual.
- Botões e fluxos atuais da conciliação continuam funcionando exatamente como hoje — as novidades são **aditivas**.

## Detalhes técnicos

- **Resumo + buckets**: calculado em `ReconcileStep.tsx` a partir de `statementLines`, `systemCandidates`, `matches`. Sem backend novo.
- **"Manter só do extrato"**: novo botão em `ReconcileStep.tsx` no card de linha "Só no extrato", ao lado do "Criar como novo". Persistência em nova tabela `import_ignored_lines` (migration com GRANTs corretos e RLS por `user_id`).
- **Alerta de órfãos**: componente `<OrphanTransactionsAlert />` + query agregada.
- **Rota `/lancamentos/sem-conta`**: reaproveita `TransactionList` com filtro `orphan=true`.
- **Saldo consolidado**: ajuste em `useDashboardData` para excluir órfãos do somatório global (cálculo por conta já ignora naturalmente).
- **Flag opcional** `orphan_reviewed boolean default false` em `transactions` para o "Ignorar" do órfão.
