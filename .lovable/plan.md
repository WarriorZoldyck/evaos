

## Correção em Massa: Datas de Pagamento de Cartão de Crédito

### Diagnóstico

Foram encontradas **100 transações** com a data de pagamento incorreta (dia diferente do `due_day` do cartão) em **2 usuários**:

| Usuário | Transações incorretas |
|---------|----------------------|
| 673ade6e... | 97 |
| b049592f... | 3 |

Já existem 82 transações com a data correta (provavelmente criadas após a correção do código).

### Causa

O sistema utilizava o `closing_day` (dia de fechamento) ou outros dias ao invés do `due_day` (dia de vencimento) na `payment_date`.

### Lógica de Correção

A correção precisa recalcular a `payment_date` com base na `competence_date` (data da compra) e no ciclo do cartão:

1. Se a compra foi feita **antes** do dia de fechamento: pertence ao ciclo daquele mês
2. Se a compra foi feita **no dia ou após** o fechamento: pertence ao ciclo do mês seguinte
3. O vencimento (`due_day`) cai no mês do fechamento se `due_day > closing_day`, ou no mês seguinte se `due_day < closing_day`

### Execução

Será executado um script SQL diretamente no banco de dados (via SQL Editor do Supabase) que:

1. Cruza cada transação de cartão de crédito com os dados do cartão (`closing_day` e `due_day`)
2. Recalcula a `payment_date` correta usando a lógica acima
3. Atualiza apenas as transações onde o dia da `payment_date` atual difere do `due_day`

### Detalhes Técnicos

O SQL calculará a data correta assim:

```text
Para cada transação:
  competence_day = dia da competence_date
  
  Se competence_day < closing_day:
    closing_month = mês da competence_date
  Senão:
    closing_month = mês seguinte à competence_date
  
  Se due_day < closing_day:
    due_month = closing_month + 1
  Senão:
    due_month = closing_month
  
  payment_date = due_month/due_day/ano
```

O script será executado no SQL Editor do Supabase para corrigir todas as 100 transações de uma vez.

