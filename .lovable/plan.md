# Edição inline no fluxo Criar (importação de extrato)

Trocar o `ReviewNewEntryModal` por um painel de edição **inline** que aparece logo abaixo da linha quando o usuário ativa o toggle **Criar**. Mesmo campos, mesma obrigatoriedade — só sem popup.

## Comportamento

- Toggle **Criar** ligado → linha expande automaticamente mostrando os campos de revisão (Descrição, Fornecedor, Categoria). A linha entra em estado `precisa-revisar`.
- Usuário preenche → botão **Confirmar** dentro do painel marca a linha como `Revisada ✓` e colapsa o painel.
- Enquanto não confirmar, a linha conta como pendente e o botão **Importar** do rodapé continua bloqueado (mesma regra de hoje).
- Toggle **Ignorar** → colapsa o painel e descarta o rascunho de revisão.
- Badge **Revisada ✓** com link **editar** (já existe hoje) reabre o painel inline em vez de abrir modal.
- Data e valor continuam apenas visíveis (não editáveis) — mesmo escopo do modal atual.

## Escopo técnico

- **`src/components/lancamentos/import/ReconcileStep.tsx`**
  - Adicionar estado local `expandedRowId` (só uma linha aberta por vez pra não poluir a tabela).
  - Ao ativar toggle Criar (`só-no-extrato` e `provável — outra compra`), setar `expandedRowId` = linha atual em vez de chamar `onOpenReview`.
  - Renderizar uma linha secundária (`<tr>` com colspan) logo abaixo, contendo o formulário inline: `Input` descrição, `ContactSelectWithCreate`, `CategoryPathCombobox`, botões **Cancelar** / **Confirmar revisão**.
  - Reaproveitar toda a lógica de defaults, validação e persistência que hoje mora no `ReviewNewEntryModal` (mover pra um hook ou pra dentro do próprio componente inline).
- **`src/components/lancamentos/ImportStatementModal.tsx`**
  - Remover renderização do `ReviewNewEntryModal` e o prop `onOpenReview` (ou deixar como no-op).
  - Manter as validações de bloqueio do rodapé (linhas Criar sem revisão continuam bloqueando importação).
- **`src/components/lancamentos/import/ReviewNewEntryModal.tsx`**
  - Deletar após confirmar que nenhum outro consumidor o usa (`rg ReviewNewEntryModal`).

## Fora de escopo

- Nenhuma mudança na lógica de matching, de "É o mesmo", "Manter só do extrato", filtro de mês da fatura, ou no cálculo de divergência.
- Sem mudanças em outras telas.
