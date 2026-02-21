

## Correcoes e Melhorias na Tabela de Parcelas

### Problemas Identificados

1. **Valores nao atualizam em tempo real**: Na `InstallmentPreviewTable`, o `value` do Input na linha 156-158 ainda usa `customAmounts[inst.number] ?? totalAmount/n` em vez de `inst.amount` (que ja contem o valor redistribuido). Isso faz com que as demais parcelas nao reflitam a redistribuicao visualmente.

2. **Valor Bruto nao atualiza**: O campo "Valor Bruto" do formulario e independente da tabela de parcelas. Quando o usuario edita parcelas e o total muda, o bruto permanece igual.

3. **Datas das parcelas nao sao editaveis**: Atualmente as datas sao calculadas automaticamente e exibidas como texto. O usuario quer poder alterar a data de vencimento de qualquer parcela individual.

4. **Excedente nao tratado**: Se ao editar parcelas a soma exceder o Valor Bruto original, o sistema deve perguntar o que fazer.

---

### Correcoes

**1. InstallmentPreviewTable -- valor visual em tempo real + datas editaveis**

Arquivo: `src/components/lancamentos/InstallmentPreviewTable.tsx`

- Trocar `value` do Input de valor de `customAmounts[inst.number] ?? Math.round((totalAmount / n) * 100) / 100` para `inst.amount` (ja calculado pelo useMemo com redistribuicao)
- Adicionar suporte a datas customizadas: nova prop `customDates: Record<number, Date>` e `onCustomDatesChange`
- Coluna "Vencimento" passa a ser um DatePicker inline compacto (Popover + Calendar) em vez de texto
- As datas customizadas sobrescrevem o calculo automatico

**2. SeriesInstallmentTable -- datas editaveis + tratamento de excedente**

Arquivo: `src/components/lancamentos/SeriesInstallmentTable.tsx`

- Coluna "Vencimento" das parcelas pendentes passa a ser um DatePicker inline editavel
- Adicionar callback `onDatesChanged` para comunicar alteracoes de datas ao pai
- Quando a soma das parcelas excede o `originalTotal`, exibir um alerta amarelo com opcoes:
  - "Atualizar valor bruto" (ajusta o original_amount)
  - "Manter e redistribuir" (diminui as demais para manter o total original)

**3. TransactionFormModal -- integrar datas customizadas + excedente na criacao**

Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`

- Adicionar estado `customInstallmentDates: Record<number, Date>` 
- Passar para `InstallmentPreviewTable` as novas props de datas
- No submit de criacao com parcelas, usar datas customizadas quando existirem em vez das calculadas
- Quando a soma das parcelas exceder o `watchAmount` (Valor Bruto), mostrar alerta perguntando se quer atualizar o Valor Bruto para o novo total ou redistribuir
- Para a `SeriesInstallmentTable`, integrar callback de datas e incluir datas no `updateMultipleTransactions`

**4. useTransactions -- update com datas**

Arquivo: `src/hooks/useTransactions.ts`

- Expandir `updateMultipleTransactions` para aceitar `{ id: string; amount: number; payment_date?: string }` (campo de data opcional)

---

### Detalhes Tecnicos

**InstallmentPreviewTable -- mudancas de props:**

```typescript
interface InstallmentPreviewTableProps {
  totalAmount: number;
  installmentsCount: number;
  paymentDate: Date;
  intervalType: "monthly" | "custom_days";
  customDays?: number;
  interestRate: number;
  customAmounts: Record<number, number>;
  onCustomAmountsChange: (amounts: Record<number, number>) => void;
  customDates: Record<number, Date>;        // NOVO
  onCustomDatesChange: (dates: Record<number, Date>) => void;  // NOVO
}
```

Cada linha de parcela tera na coluna "Vencimento" um botao compacto tipo DatePicker (Popover + Calendar) em vez de texto puro. Ao clicar, abre o calendario para escolher a data. Isso permite que o cliente escolha, por exemplo, duas parcelas no mesmo dia.

**Tratamento de excedente na criacao:**

Quando `total > totalAmount` (soma das parcelas > valor bruto), exibir abaixo da tabela um alerta:

```
⚠ O total das parcelas (R$ 120,00) excede o valor bruto (R$ 100,00).
[Atualizar valor bruto para R$ 120,00]
```

Ao clicar, chama `form.setValue("amount", novoTotal)`.

**Tratamento de excedente na edicao (SeriesInstallmentTable):**

Quando `total > originalTotal`, exibir alerta similar. O botao "Atualizar valor bruto" comunica ao pai para ajustar o `original_amount` de todas as transacoes da serie.

---

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/lancamentos/InstallmentPreviewTable.tsx` | Corrigir value do Input, adicionar datas editaveis, alerta de excedente |
| `src/components/lancamentos/SeriesInstallmentTable.tsx` | Adicionar datas editaveis, alerta de excedente |
| `src/components/lancamentos/TransactionFormModal.tsx` | Integrar datas customizadas, tratar excedente |
| `src/hooks/useTransactions.ts` | Expandir updateMultipleTransactions para aceitar datas |

