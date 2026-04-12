

## Plano: Corrigir R$ duplicado e tornar edição em tempo real na Precificação

### Problemas identificados

1. **R$ duplicado na tabela** -- `InlineEditCell` recebe `prefix="R$"` e renderiza `prefix + fmt(value)`, mas `fmt()` já inclui "R$", resultando em "R$R$ 0,00"
2. **Edição por duplo clique** -- tanto na tabela quanto no breakdown, o usuário precisa dar duplo clique e depois Enter/blur para salvar. Deveria funcionar como a Calculadora de Preço Sugerido: inputs sempre visíveis com spinners, atualizando em tempo real

### Mudanças

**1. `ProcedureTableV2.tsx` -- Corrigir R$ duplicado + inputs sempre visíveis**
- Remover o `prefix="R$"` da chamada de `InlineEditCell` para o campo preço, ou ajustar a lógica para não duplicar o símbolo
- Substituir `InlineEditCell` (double-click) por inputs `type="number"` sempre visíveis com spinners nativos nos campos Preço e Tempo
- `onChange` dispara atualização imediata (com debounce leve) em vez de exigir Enter/blur

**2. `ProcedureBreakdownV2.tsx` -- Inputs sempre visíveis com atualização em tempo real**
- Substituir `InlineValue` (double-click) por inputs numéricos sempre visíveis com spinners para Valor Cobrado e Tempo de Execução
- Usar estado local temporário que atualiza o cálculo visualmente em tempo real enquanto o usuário ajusta
- Salvar no banco via `onBlur` ou após debounce, mas o breakdown recalcula instantaneamente

**3. Lógica de atualização em tempo real**
- O breakdown já recebe `calcProcedure(procedure)` -- ao mudar o valor local, os cálculos (CF, CV, NF, Líquido) atualizam automaticamente na tela
- Manter sincronia: quando o input do breakdown muda, a tabela também reflete e vice-versa

### Arquivos afetados
- `src/components/precificacao-v2/ProcedureTableV2.tsx`
- `src/components/precificacao-v2/ProcedureBreakdownV2.tsx`

