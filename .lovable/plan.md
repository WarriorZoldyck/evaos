
## Adicionar Campo de Juros ao Parcelamento de Lancamentos

Adicionar um campo de taxa de juros (%) ao formulario de lancamentos parcelados, para que o valor total com juros seja calculado automaticamente e distribuido entre as parcelas.

### Experiencia do Usuario

Quando o usuario ativa "Parcelado?" e preenche o numero de parcelas, aparecera um novo campo opcional **"Taxa de juros (%)"**. Ao preencher (ex: 1.99%), o sistema calcula automaticamente:

- O valor total com juros (usando juros compostos)
- O valor de cada parcela
- Exibe um resumo: "12x de R$ 95,40 = R$ 1.144,80 (juros: R$ 144,80)"

Se o campo de juros ficar vazio ou zero, o comportamento atual e mantido (divisao simples sem juros).

### Calculo

Sera usado o metodo **Price (parcelas fixas)** -- o padrao brasileiro para financiamentos e parcelamentos com juros:

```text
PMT = PV * [ i * (1+i)^n ] / [ (1+i)^n - 1 ]

Onde:
  PV = valor presente (amount digitado)
  i  = taxa de juros mensal (ex: 1.99% = 0.0199)
  n  = numero de parcelas
  PMT = valor de cada parcela
```

### Alteracoes

**Arquivo modificado: `src/components/lancamentos/TransactionFormModal.tsx`**

1. **Schema**: Adicionar campo `interest_rate` ao `transactionSchema`:
   - `interest_rate: z.coerce.number().min(0).max(100).optional()`

2. **Default values**: Adicionar `interest_rate: 0` aos defaults do form

3. **UI (area de parcelamento)**: Apos o campo "Numero de parcelas", adicionar:
   - Input "Taxa de juros mensal (%)" com placeholder "Ex: 1.99"
   - Resumo calculado em tempo real mostrando: valor da parcela, total com juros, total de juros cobrados

4. **Logica de submit (handleMainSubmit)**: No bloco de criacao de parcelas (linha ~497):
   - Se `interest_rate > 0`, calcular PMT usando formula Price
   - `total_com_juros = PMT * n`
   - Cada parcela recebe `amount = PMT`
   - `original_amount` permanece como o valor original sem juros
   - Se `interest_rate` for 0 ou vazio, manter logica atual (divisao simples)

### Resumo visual no formulario

Quando juros > 0:
```text
[x] Parcelado?
  Numero de parcelas: [12]
  Taxa de juros mensal (%): [1.99]
  
  12x de R$ 95,40 = R$ 1.144,80
  Juros totais: R$ 144,80
```

Quando juros = 0 (comportamento atual mantido):
```text
[x] Parcelado?
  Numero de parcelas: [12]
  Taxa de juros mensal (%): [    ]
  
  12x de R$ 83,33 = R$ 1.000,00
```

### Detalhes tecnicos

- A funcao Price sera implementada inline no componente (poucas linhas)
- O campo `original_amount` ja existe na tabela e sera usado para guardar o valor original sem juros
- Nenhuma alteracao no banco de dados necessaria
- O campo "Valor da 1a parcela diferente" sera desabilitado quando juros > 0 (Price calcula parcelas fixas)
- Compatibilidade total com o fluxo existente de edicao e exclusao de series
