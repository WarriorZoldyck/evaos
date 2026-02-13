

## Correcao da Leitura de Taxas da Maquininha

### Problema Raiz

O `MdrInfoCard` (preview em tempo real) e o `TransactionFormModal` (logica de salvamento) comparam o numero de parcelas para encontrar a taxa correta na tabela `rates_info`. O problema e uma **incompatibilidade de tipo** na comparacao:

- `form.watch("installments_count")` retorna uma **string** (ex: `"3"`) porque vem diretamente do input HTML
- `rates_info` armazena `installments` como **number** (ex: `3`)
- A comparacao `r.installments === installmentsCount` usa `===` (igualdade estrita), entao `3 === "3"` retorna `false`
- Resultado: a taxa especifica nunca e encontrada, e o sistema cai no fallback `credit_rate` (taxa de credito a vista)

Exemplo real com o terminal "TESTE D+2" (2x=4%, 3x=5%, 4x=6%):
- Usuario seleciona 3x parcelas
- Sistema busca `rates.find(r => r.installments === "3")` -- nao encontra
- Usa fallback `credit_rate = 3.29%` em vez de `5%`

### Correcoes

**Arquivo 1: `src/components/lancamentos/MdrInfoCard.tsx`**
- Na funcao de busca de taxa, converter `installmentsCount` para numero antes de comparar:
  `rates.find(r => r.installments === Number(installmentsCount))`

**Arquivo 2: `src/components/lancamentos/TransactionFormModal.tsx`**
- Na logica de salvamento (handleMainSubmit), tambem garantir conversao:
  `rates.find((r: any) => r.installments === Number(data.installments_count))`
- Embora o Zod faca coercao, e mais seguro forcar a conversao explicitamente

**Arquivo 3: `src/components/lancamentos/PaymentMethodFields.tsx`**
- Converter `installmentsCount` para numero antes de passar ao MdrInfoCard:
  `installmentsCount={isInstallment ? Number(installmentsCount) : undefined}`

### Detalhes Tecnicos

```text
Antes (falha silenciosa):
  rates.find(r => r.installments === installmentsCount)
  // installmentsCount = "3" (string do form.watch)
  // r.installments = 3 (number do JSON)
  // 3 === "3" -> false -> usa credit_rate base

Depois (correto):
  rates.find(r => r.installments === Number(installmentsCount))
  // Number("3") = 3
  // 3 === 3 -> true -> usa taxa correta (5%)
```

Sao 3 linhas alteradas em 3 arquivos. Correcao cirurgica sem efeitos colaterais.

