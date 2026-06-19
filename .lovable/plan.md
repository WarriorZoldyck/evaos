
# Conciliação inteligente no Importar Extrato (OFX/CSV/PDF)

## Para a Marcela (explicação simples, sem termo técnico)

Hoje, quando você importa o extrato do banco, o sistema cria **todos os lançamentos do zero**. Isso é um problema pro BPO porque você normalmente já lançou as contas fixas (aluguel, internet, salários, parcelas) **antes** do dinheiro sair da conta — elas ficam como "Pendente" esperando a data. Aí, quando você importa o OFX no fim do mês, o sistema duplica tudo: fica o lançamento antigo Pendente + o novo do extrato Pago.

**O que vai mudar:** antes de importar, o sistema compara cada linha do extrato com o que você já tem no EVA (lançamentos pendentes + parcelas de cartão + recorrências dos próximos 90 dias). Para cada linha encontrar um "par", você decide:

| Ação | O que faz |
|---|---|
| **Vincular** | Não cria nada novo. Pega o lançamento que já existia, marca como **Pago**, ajusta a data de pagamento pra do extrato e concilia. |
| **Criar novo** | Comportamento atual: gera um lançamento novo. |
| **Ignorar** | Pula essa linha do extrato (ex: tarifa que você não quer registrar). |

Linhas que **não** acham par seguem normalmente como "Criar novo" (pré-marcadas).

Resultado: zero duplicidade, fechamento de mês em minutos, e os Pendentes desaparecem sozinhos conforme caem na conta.

---

## Como o "match" funciona (regra de negócio)

Para cada linha do extrato o sistema busca candidatos em `transactions` com:

1. **Mesma conta de destino** (a conta selecionada na importação).
2. **Status = Pendente** OU **recorrência projetada** dos próximos 90 dias (mesma lógica do `useRecurringTransactions`).
3. **Mesmo tipo** (crédito do extrato → receita; débito → despesa).
4. **Mesmo valor exato** (`amount`).
5. **Data de vencimento dentro de ±7 dias** da data do extrato (janela configurável; default 7).

**Score de confiança** (ordena os candidatos quando há mais de um):
- +40 valor exato (obrigatório)
- +20 mesma data exata / +10 até 3 dias / +5 até 7 dias
- +15 descrição com termo em comum (contato ou categoria)
- +10 mesmo contato (se a importação já resolveu)

Apenas o candidato de maior score vira sugestão pré-marcada como **Vincular**. Os outros ficam acessíveis num "trocar correspondência".

Recorrência projetada (ainda não materializada) → ao Vincular, o sistema materializa a ocorrência real (insere em `transactions` com status Pago) em vez de atualizar.

Parcela de cartão e fatura: fora do escopo desta v1 (cartão já tem fluxo próprio de pagamento de fatura).

---

## UX no modal Importar Extrato

Adiciona uma **etapa 3 "Conciliar"** entre o preview atual e o "Importar":

```text
[ 1.Arquivo ] → [ 2.Conferir ] → [ 3.Conciliar ] → [ 4.Importar ]
```

Tabela da etapa Conciliar:

```text
┌──────────────┬──────────┬──────────┬─────────────────────────┬──────────────────┐
│ Data extrato │ Descrição│ Valor    │ Sugestão do EVA         │ Ação             │
├──────────────┼──────────┼──────────┼─────────────────────────┼──────────────────┤
│ 05/06        │ ALUGUEL  │ -3.500,00│ ✓ Aluguel Junho (Pend.) │ [Vincular ▾]     │
│ 05/06        │ ENEL     │   -287,40│ — sem correspondência   │ [Criar novo ▾]   │
│ 06/06        │ PIX João │ +1.200,00│ ✓ Recorrência Cliente J │ [Vincular ▾]     │
│ 06/06        │ TARIFA   │     -9,90│ — sem correspondência   │ [Ignorar ▾]      │
└──────────────┴──────────┴──────────┴─────────────────────────┴──────────────────┘
Resumo: 12 vincular · 8 criar novo · 2 ignorar
```

- Topo: contador + botão "Marcar todos os match como Vincular" / "Criar tudo do zero" (volta ao comportamento atual).
- Clique na sugestão abre um popover com os outros candidatos e link "Ver lançamento".
- Botão final: **Importar (12 vinculados, 8 criados, 2 ignorados)**.

---

## Detalhes técnicos

**Arquivos a alterar:**
- `src/components/lancamentos/ImportStatementModal.tsx` — nova etapa "Conciliar"; estado `matches: Map<lineId, { action, transactionId? }>`.
- `src/hooks/useImportMatching.ts` (novo) — recebe linhas parseadas + accountId, busca candidatos em lote, calcula score, devolve sugestões. Inclui recorrências projetadas usando o mesmo gerador de `useRecurringTransactions`.
- `src/lib/import/matching.ts` (novo) — funções puras `scoreCandidate`, `pickBestMatch`, testáveis.
- `src/components/lancamentos/import/MatchRow.tsx` (novo) — linha da tabela com popover de candidatos.

**Persistência ao confirmar:**
- `Vincular` → `UPDATE transactions SET status='Pago', payment_date=<data extrato>, is_reconciled=true, bank_account_id=<conta>` (só se ainda Pendente — proteção contra race).
- `Vincular` em recorrência projetada → `INSERT` na `transactions` (materializa) com status Pago + `recurring_transaction_id` preenchido.
- `Criar novo` → fluxo atual de inserção.
- `Ignorar` → nada.

Tudo numa transação lógica no client (Promise.all com rollback visual em caso de falha parcial — mostra quais linhas falharam).

**Busca em lote (1 query só):**
```sql
SELECT id, description, amount, due_date, type, status, recurring_transaction_id, contact_id, category_id
FROM transactions
WHERE bank_account_id = $1
  AND status = 'Pendente'
  AND due_date BETWEEN <min_data - 7> AND <max_data + 7>
  AND amount IN (<lista de valores únicos do extrato>)
```
+ chamada paralela ao gerador de recorrências projetadas da mesma conta/janela.

**Configurações (constantes, sem UI v1):**
- Janela de data: ±7 dias.
- Tolerância de valor: 0 (exato). v2 pode abrir ±R$ 0,02 pra arredondamento.

**Fora do escopo desta entrega:**
- Match de fatura de cartão (fluxo separado já existe).
- Match many-to-one (uma transferência do extrato cobrindo várias contas).
- Aprendizado/sugestão por descrição (machine learning).
- Tela dedicada de "Conciliação" para OFX (hoje `/conciliacao` é só Asaas).

---

## Critérios de aceite

1. Importar um OFX com 10 linhas, sendo 6 já cadastradas como Pendente: etapa Conciliar mostra 6 sugestões de Vincular, 4 de Criar novo.
2. Confirmar a importação: as 6 Pendentes viram Pago com a data do extrato; 4 novas são criadas; nenhum duplicado.
3. Importar um OFX com uma recorrência ainda não materializada (próximos 90 dias): aparece como sugestão de Vincular; ao confirmar, é materializada como Pago.
4. Botão "Criar tudo do zero" reproduz exatamente o comportamento atual (regressão zero).
5. Linha sem candidato continua com "Criar novo" pré-marcado.

---

## Estimativa
Médio — 1 hook novo, 1 lib pura com testes, 1 etapa nova no modal de import, 2 caminhos de persistência. Sem migração de banco.
