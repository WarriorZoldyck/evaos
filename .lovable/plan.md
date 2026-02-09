
## Integrar Lançamentos Recorrentes (`recurring_transactions`) no App

### O Problema

A tabela `recurring_transactions` tem **42 registros** (24 mensais, 18 diarios) que nunca sao consultados pelo app. Nenhum arquivo no codigo faz referencia a essa tabela. O dashboard e a pagina de lancamentos so consultam a tabela `transactions`, por isso:

1. Lancamentos recorrentes de boleto e outros meios nao aparecem
2. Previstos de pagamento ficam incompletos (faltam os que vem de recorrencias)

### A Solucao

Criar um hook `useRecurringTransactions` que busca os registros recorrentes e "materializa" as ocorrencias futuras (calcula as datas de cada repeticao com base na frequencia). Essas ocorrencias virtuais serao exibidas tanto no Dashboard (Proximos Lancamentos) quanto na pagina de Lancamentos.

---

### Etapa 1 - Hook `useRecurringTransactions`

**Arquivo novo:** `src/hooks/useRecurringTransactions.ts`

- Faz `select(*)` na tabela `recurring_transactions` com filtro de company/personal
- Para cada registro, gera as ocorrencias futuras entre hoje e um horizonte (ex: 90 dias):
  - `frequency = "monthly"`: adiciona 1 mes ao `payment_date` para cada repeticao, ate `end_date` ou horizonte
  - `frequency = "daily"`: adiciona 1 dia para cada repeticao
- Cada ocorrencia gerada tem um ID virtual (ex: `rec_{id}_{YYYY-MM-DD}`) e os dados do registro pai
- Retorna a lista de ocorrencias no mesmo formato da interface `Transaction` usada pelo dashboard, com um campo extra `isRecurring: true` para diferenciar visualmente

### Etapa 2 - Integrar no Dashboard

**Arquivo modificado:** `src/hooks/useDashboardData.ts`

- Importar e chamar o hook de recorrentes
- No calculo de `upcomingTransactions`, mesclar os lancamentos pendentes de `transactions` com as ocorrencias geradas de `recurring_transactions`
- Ordenar tudo por `payment_date` e limitar a 10 itens
- Na projecao de saldo (`getProjectionData`), incluir as ocorrencias recorrentes futuras no calculo do saldo projetado

### Etapa 3 - Integrar na Pagina de Lancamentos

**Arquivo modificado:** `src/hooks/useTransactions.ts`

- Adicionar um fetch de `recurring_transactions` e gerar ocorrencias futuras
- Mesclar com os lancamentos normais na listagem quando o filtro de status for "Pendente" ou "todos"
- Marcar visualmente esses lancamentos como "Recorrente" na tabela

### Etapa 4 - Indicador Visual

**Arquivo modificado:** `src/components/lancamentos/TransactionTable.tsx`

- Quando o lancamento for recorrente (`isRecurring`), exibir um badge "Recorrente" ou icone de repeticao (Repeat) ao lado da descricao

**Arquivo modificado:** `src/components/dashboard/UpcomingTransactions.tsx`

- Adicionar badge ou icone de recorrencia nos itens que vem de `recurring_transactions`

---

### Detalhes Tecnicos

**Logica de geracao de ocorrencias:**

```text
Para cada recurring_transaction:
  data_atual = max(start_date, hoje)
  enquanto data_atual <= min(end_date, hoje + 90 dias):
    criar ocorrencia virtual com:
      id: "rec_" + registro.id + "_" + formato(data_atual)
      description, amount, type, category, payment_method, etc do registro pai
      payment_date: data_atual
      status: "Pendente"
      isRecurring: true
    
    se frequency == "monthly": data_atual += 1 mes
    se frequency == "daily": data_atual += 1 dia
```

**Campos de `recurring_transactions` que serao mapeados:**

| Campo recorrente | Campo na interface Transaction |
|---|---|
| description | description |
| amount | amount |
| type | type |
| category | category |
| payment_method | payment_method |
| bank_account_id | bank_account_id |
| credit_card_id | credit_card_id |
| contact_name | contact_name |
| series_id | series_id |

**Arquivos a serem criados:**

| Arquivo | Descricao |
|---|---|
| `src/hooks/useRecurringTransactions.ts` | Hook que busca recorrentes e materializa ocorrencias futuras |

**Arquivos a serem modificados:**

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useDashboardData.ts` | Mesclar ocorrencias recorrentes em upcomingTransactions e projecao |
| `src/hooks/useTransactions.ts` | Mesclar recorrentes na listagem de lancamentos |
| `src/components/lancamentos/TransactionTable.tsx` | Badge visual para lancamentos recorrentes |
| `src/components/dashboard/UpcomingTransactions.tsx` | Badge visual para recorrentes |

**Nenhuma migracao de banco necessaria** - a tabela `recurring_transactions` ja existe com todos os campos.
