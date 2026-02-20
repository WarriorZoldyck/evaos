

## Correções: Categorias por Contexto + Parcelamento "A cada X dias"

### Problema 1: Categorias não atualizam ao trocar contexto

**Causa raiz:** A funcao `handleContextChange` (linha 428) chama `setFormCompanyId(companyId)`, mas a busca de categorias depende de um `useEffect` que observa `fetchFormCategories` (um `useCallback` que depende de `formCompanyId`). Como o `setState` do React eh assincrono, o `useCallback` ainda nao foi recriado no momento em que o `useEffect` roda, causando a necessidade de trocar o contexto duas vezes.

**Solucao:** Adicionar `formCompanyId` diretamente como dependencia do `useEffect` que busca categorias (linha 328), garantindo que a busca seja disparada sempre que o contexto mudar:

```text
// De:
useEffect(() => {
  if (open) fetchFormCategories();
}, [fetchFormCategories, open]);

// Para:
useEffect(() => {
  if (open) fetchFormCategories();
}, [fetchFormCategories, open, formCompanyId]);
```

Alem disso, limpar as selecoes de categoria ao trocar contexto no `handleContextChange`:

```text
form.setValue("category", "");
form.setValue("subcategory", "");
form.setValue("subcategory2", "");
```

---

### Problema 2: "A cada X dias" no parcelamento

Hoje, parcelas sempre usam `addMonths` para calcular datas. O usuario quer poder definir um intervalo em dias tambem para parcelas (nao so recorrencia).

**Solucao:**

1. Adicionar um campo `installment_interval_type` ao schema Zod com opcoes `"monthly"` e `"custom_days"`, e um campo `installment_custom_days` (inteiro, 1-365).

2. Na UI da secao "Parcelado", adicionar um seletor de intervalo (Mensal / A cada X dias) abaixo do numero de parcelas, e um campo numerico condicional para o intervalo em dias.

3. Na logica de submit (linha 603), substituir `addMonths(data.payment_date, idx)` por logica condicional:
   - Se `monthly`: manter `addMonths`
   - Se `custom_days`: usar `addDays(data.payment_date, idx * interval)`

4. Garantir que as datas calculadas sao salvas corretamente ja na primeira gravacao (sem necessidade de editar depois).

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**

Mudancas no schema:
```text
installment_interval_type: z.enum(["monthly", "custom_days"]).default("monthly"),
installment_custom_days: z.coerce.number().int().min(1).max(365).optional(),
```

Mudanca na UI (dentro do bloco `watchInstallment`):
```text
<FormField name="installment_interval_type" ...>
  <Select> Mensal | A cada X dias </Select>
</FormField>
{watchIntervalType === "custom_days" && (
  <FormField name="installment_custom_days" ...>
    <Input type="number" placeholder="Ex: 15" />
  </FormField>
)}
```

Mudanca no submit:
```text
const intervalType = data.installment_interval_type || "monthly";
const customDays = data.installment_custom_days || 30;

for (let idx = 0; idx < count; idx++) {
  const payDate = intervalType === "custom_days"
    ? addDays(data.payment_date, idx * customDays)
    : addMonths(data.payment_date, idx);
  // ...
}
```

---

### Resumo de alteracoes

| Arquivo | O que muda |
|---------|-----------|
| `TransactionFormModal.tsx` | Corrigir useEffect de categorias; limpar selecao de categoria ao trocar contexto; adicionar campos e logica de intervalo no parcelamento |

Nenhuma alteracao no banco de dados necessaria.
