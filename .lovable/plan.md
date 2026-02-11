

## Correcao do Faturamento - Usar Data de Competencia

### Problema Confirmado

O codigo atual tem **uma unica query** que filtra por `payment_date`:

```text
.gte("payment_date", startStr)
.lte("payment_date", endStr)
```

Tanto `faturamento` quanto `previstoReceitas` sao calculados a partir dessa mesma query. Isso significa que:
- Faturamento = receitas com **pagamento** no periodo (errado)
- Deveria ser = receitas com **competencia** no periodo

### Solucao

**Arquivo: `src/hooks/useDashboardData.ts`**

1. Adicionar uma **segunda query** que filtra por `competence_date` no periodo selecionado
2. Armazenar em um novo estado `competenceTransactions`
3. Usar esse novo conjunto para calcular `faturamento`, `previstoReceitas` e `previstoSaidas`
4. Manter `entradas`, `saidas`, `saldo`, `consolidadoReceitas` e `consolidadoSaidas` usando a query existente (por `payment_date`, status "Pago")

### Calculo Final

| Metrica | Fonte de dados | Filtro de status |
|---|---|---|
| Faturamento | `competence_date` no periodo | Todas receitas (Pago + Pendente) |
| Entradas | `payment_date` no periodo | Receitas "Pago" |
| Saidas | `payment_date` no periodo | Despesas "Pago" |
| Saldo | `payment_date` no periodo | entradas - saidas |
| Previsto Receitas | `competence_date` no periodo | Todas receitas |
| Previsto Saidas | `competence_date` no periodo | Todas despesas |
| Consolidado Receitas | `payment_date` no periodo | Receitas "Pago" |
| Consolidado Saidas | `payment_date` no periodo | Despesas "Pago" |

### Detalhes Tecnicos

Nova query no `useEffect` existente (ou em um novo `useEffect` paralelo):

```text
supabase.from("transactions")
  .select(...)
  .gte("competence_date", startStr)
  .lte("competence_date", endStr)
  .eq("company_id", ...) // ou .is("company_id", null)
```

Novo estado:
```text
const [competenceTransactions, setCompetenceTransactions] = useState([]);
```

Calculo atualizado no `useMemo`:
```text
faturamento = competenceTransactions
  .filter(t => t.type === "receita")
  .reduce(sum)

previstoReceitas = faturamento
previstoSaidas = competenceTransactions
  .filter(t => t.type === "despesa")
  .reduce(sum)
```

### Arquivo modificado

- `src/hooks/useDashboardData.ts` (unico arquivo)

