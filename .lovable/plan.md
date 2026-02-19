

## Correção: Juros em Lançamentos de Cartão de Crédito

### Diagnóstico

O formulário de lançamentos possui o campo "Taxa de juros mensal (%)" que aparece ao ativar "Parcelado" (quando não há maquininha selecionada). A lógica de cálculo Price (Sistema Francês) existe no submit e parece correta em teoria. No entanto, há um problema sutil com o tratamento do campo `interest_rate` pelo Zod + React Hook Form:

**Problema identificado:** O campo `interest_rate` usa `z.coerce.number().min(0).max(100).optional()`. Com `<Input type="number" />` e React Hook Form, o valor pode não ser coercionado corretamente no momento do submit dependendo do estado interno do campo. Além disso, a condição `data.interest_rate || 0` trata o valor `undefined` mas pode mascarar cenários onde o valor chega como string.

### Alterações Planejadas

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**

1. Tornar a coerção do `interest_rate` mais robusta no schema Zod, usando `.default(0)` em vez de `.optional()` para garantir que sempre seja um número.

2. Na função `handleMainSubmit`, tornar a leitura do interesse mais explícita:
   - Usar `Number(data.interest_rate)` para garantir que é um número
   - Adicionar log de debug temporário para validar o fluxo

3. Garantir que o `original_amount` é salvo corretamente (valor sem juros) e o `amount` de cada parcela inclui os juros (PMT da tabela Price).

4. Na preview de parcelas (já funciona na UI), manter a mesma lógica para consistência.

### Detalhes Técnicos

Mudança no schema:
```text
// De:
interest_rate: z.coerce.number().min(0).max(100).optional(),

// Para:
interest_rate: z.coerce.number().min(0).max(100).default(0),
```

Mudança no submit (linha ~565):
```text
const interestRate = Number(data.interest_rate) || 0;
```

Isso garante que mesmo se o valor chegar como string ou undefined, será tratado como número. A lógica de cálculo Price já existente permanece a mesma, apenas a leitura do valor fica mais defensiva.

### Escopo

- Apenas novos lançamentos serão afetados (conforme solicitado)
- Nenhuma migração de dados existentes
- Nenhuma alteração no banco de dados

