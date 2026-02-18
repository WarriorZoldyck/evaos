

## Correções no "Próximos Lançamentos" do Dashboard

### 3 Problemas Identificados

**1. Categoria mostrando UUID/código ao invés do nome**
O `upcomingTransactions` no hook `useDashboardData.ts` passa o campo `category` bruto da tabela (que pode ser um UUID). A função `resolveCategoryName` já existe no hook mas não é aplicada nos dados de "Próximos Lançamentos".

**2. Lançamentos do dia sem botão de Liquidar/Excluir**
A condição `!t.isRecurring` no componente `UpcomingTransactions.tsx` (linha 206) esconde o botão "Liquidar" para transações recorrentes. Mas transações normais do dia (não recorrentes) que aparecem como pendentes deveriam mostrar os botões de Liquidar e Excluir -- e atualmente só mostram Liquidar.

**3. Fatura sem opção de liquidação parcial**
A fatura já usa o `LiquidateModal` que suporta pagamento parcial (etapa 2 com tratamento de diferença). O fluxo já funciona -- o usuário pode alterar o valor na etapa 1 e o modal avança para a etapa 2 automaticamente. Não há bug aqui, mas o botão diz apenas "Liquidar Fatura", o que pode dar a impressão de que não há opção parcial. Vou melhorar o label para deixar claro.

---

### Alterações Planejadas

**Arquivo: `src/hooks/useDashboardData.ts`**
- Na construção de `upcomingTransactions` (linhas 367-381), aplicar `resolveCategoryName` no campo `category` de cada transação antes de retornar, garantindo que sempre exiba o nome da categoria ao invés do UUID.

**Arquivo: `src/components/dashboard/UpcomingTransactions.tsx`**
- Remover a condição `!t.isRecurring` que esconde o botão Liquidar (linha 206), permitindo que TODOS os lançamentos pendentes tenham o botão.
- Adicionar botão "Excluir" ao lado de "Liquidar" para transações normais (não recorrentes), com confirmação antes de deletar.
- Receber uma prop `onDelete` para executar a exclusão via Supabase.
- Para a fatura, manter o fluxo atual (já suporta parcial) mas ajustar o texto do botão para "Pagar Fatura" para ficar mais claro.

**Arquivo: `src/pages/Dashboard.tsx`**
- Passar a função de exclusão (`onDelete`) para o componente `UpcomingTransactions`.

### Detalhes Técnicos

- A resolução de categoria usa a função `resolveCategoryName` já existente que busca por UUID na lista de `categoryRecords` e retorna o nome legível.
- A exclusão de transações usará `supabase.from("transactions").delete().eq("id", id)` diretamente no componente, com um `AlertDialog` de confirmação.
- Nenhuma alteração no banco de dados é necessária.

