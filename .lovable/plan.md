# Metas: excluir objetivo, planejamento que não se perde e Objetivos como 3ª coluna

## 1. Excluir uma meta (objetivo)

Hoje só é possível excluir entrando na página de detalhe do objetivo (`/metas/:id` já tem o botão "Excluir"), o que quase ninguém encontra.

- Cada item da lista de Objetivos ganha um menu (⋮) com **Abrir**, **Editar** e **Excluir**.
- "Excluir" abre uma confirmação explicando que o histórico de reservas/retiradas daquele objetivo também será apagado.
- Após excluir, a lista se atualiza sozinha e, se o objetivo excluído era o selecionado, a seleção passa para o próximo da lista.

## 2. O planejamento não pode resetar ao recarregar

Verificado: a tabela de metas orçamentárias existe e está com as permissões corretas, mas **não há nenhum registro gravado** — ou seja, hoje o ajuste que o usuário faz não chega ao banco em vários caminhos.

Correções:

- **Salvar em todos os pontos de edição**, não só no painel lateral: régua de percentual, campo de valor-alvo digitado e o botão de reset gravam imediatamente (com espera curta para não sobrecarregar).
- **Confirmação visível**: indicador discreto de "salvando / salvo" no topo do bloco de metas e aviso de erro caso a gravação falhe (hoje a falha é silenciosa).
- **Recarregar restaura o estado**: ao abrir a página, os percentuais são reconstruídos a partir das metas salvas do contexto atual (Pessoal/Empresa). A reconstrução só acontece depois que as categorias e as metas terminaram de carregar, evitando o "pisca e zera" atual.
- **Trocar de contexto ou de página não apaga nada**: cada contexto tem seu próprio conjunto de metas, e sair para a página de um objetivo e voltar mantém tudo, porque o estado vive no banco e não na tela.
- Também ficam lembrados (por usuário, no navegador) o bloco aberto (Entradas/Saídas) e a categoria selecionada, para a tela voltar exatamente como estava.

## 3. "Meus Objetivos" vira a 3ª coluna à direita

- A página passa a ter três colunas em telas grandes: **Metas Orçamentárias** (real + meta), **Resumo/Insights** e, à direita, **Meus Objetivos**.
- Em telas menores as colunas empilham na mesma ordem.
- A coluna de Objetivos fica compacta: nome, tipo, quanto representa da sobra mensal e barra de progresso — sem os blocos grandes de acompanhamento.
- **Clicar em um objetivo abre a página dele** (`/metas/:id`), onde ficam progresso, score, plano de ação e o chat da EVA. Esses blocos saem do rodapé da página de Metas, que fica só com o planejamento.
- Como o planejamento está salvo no banco, navegar para o objetivo e voltar não perde nenhum ajuste; o botão "voltar" retorna para Metas no mesmo estado.
- A largura máxima da página é ajustada para acomodar as três colunas sem apertar os cards.

## Detalhes técnicos

- `src/hooks/useGoals.ts`: `deleteGoal` já existe; será exposto na lista.
- `src/components/metas/planejamento/ObjectivesPanel.tsx`: item vira card compacto com `DropdownMenu` (abrir/editar/excluir) + `AlertDialog` de confirmação.
- `src/hooks/useBudgetTargets.ts`: adicionar estado `saving`/`error`, tratar retorno do `upsert` (hoje ignorado) e expor `flush()` para gravar pendências ao desmontar/navegar.
- `src/pages/Metas.tsx`: hidratação passa a exigir `stats.incomeCategories.length || stats.expenseCategories.length` antes de marcar como hidratada e reexecuta quando o contexto muda; `persistTarget` é chamado em todos os handlers de alteração; grid principal vira `xl:grid-cols-[minmax(0,1fr)_210px_300px]`.
- Blocos `ActiveGoalCard`, `GoalChat`, `GoalProgressPanel`, `GoalResolutionPanel` e `ActionPlanList` migram do rodapé de `Metas.tsx` para `src/pages/MetaDetalhe.tsx`.
- Persistência de UI (bloco aberto, categoria selecionada) em `localStorage` por usuário+contexto.
