

## Adicionar opção "A cada X dias" nas frequências de recorrência

### O que muda

Adicionar uma nova opção de frequência "A cada X dias" no formulário de lançamento recorrente, permitindo que o usuário defina um intervalo personalizado em dias (ex: a cada 3 dias, a cada 10 dias, etc.).

### Alterações

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**

1. **Adicionar frequência na lista `RECURRING_FREQUENCIES`:**
   - Nova opção: `{ value: "custom_days", label: "A cada X dias" }`

2. **Adicionar campo no schema Zod:**
   - `recurring_custom_days: z.coerce.number().int().min(1).max(365).optional()`

3. **Adicionar campo de input condicional na UI:**
   - Quando a frequência selecionada for `"custom_days"`, exibir um campo numérico "Intervalo em dias" logo abaixo do seletor de frequência
   - Campo com mínimo 1 e máximo 365

4. **Atualizar a lógica de submit (`getNextDate` e `maxOccurrences`):**
   - Adicionar case `"custom_days"` no switch que calcula a próxima data, usando `data.recurring_custom_days` como intervalo
   - Calcular `maxOccurrences` dinamicamente: `Math.floor(365 / customDays)` (limitado a 365 ocorrências)

5. **Atualizar valores padrão do formulário:**
   - Incluir `recurring_custom_days: undefined` nos defaults e no reset

**Arquivo: `src/hooks/useRecurringTransactions.ts`**

6. **Suportar frequência `custom_days` na geração de ocorrências virtuais:**
   - Buscar um campo que indique o intervalo personalizado (pode ser o `day_of_month` reutilizado, já que não faz sentido para frequência custom_days)
   - Adicionar `else if (rec.frequency === "custom_days")` no loop de geração, usando `addDays(current, rec.day_of_month || 1)`

### Detalhes técnicos

Trecho da UI (condicional ao selecionar "A cada X dias"):
```text
{watchRecurringFrequency === "custom_days" && (
  <FormField
    name="recurring_custom_days"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Intervalo em dias</FormLabel>
        <Input type="number" min={1} max={365} placeholder="Ex: 15" {...field} />
      </FormItem>
    )}
  />
)}
```

Trecho do submit:
```text
case "custom_days": {
  const interval = data.recurring_custom_days || 30;
  const d = new Date(base);
  d.setDate(d.getDate() + index * interval);
  return d;
}
```

maxOccurrences para custom_days:
```text
const customDays = data.recurring_custom_days || 30;
const maxOcc = frequency === "custom_days" ? Math.floor(365 / customDays) : ...;
```
