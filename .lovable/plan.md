## Objetivo
Garantir que, ao clicar em "É o mesmo" em qualquer seção (Provável ou Só no sistema), a linha desapareça imediatamente do local do clique e reapareça no bloco "Vinculadas manualmente" com feedback visível — inclusive no modo cartão.

## Situação atual (já implementado no último turno)
Em `src/components/lancamentos/import/ReconcileStep.tsx`:
- `handleMarkSame` marca `action=vincular`, define `matchTargets[i]`, adiciona `i` a `dismissedSuggestions` e o target a `linkedOrphans`, e emite toast.
- `matchedExactRows` / `matchedToleranceRows` agora excluem `dismissedSuggestions.has(i)`.
- `suggestedRows` já exclui `dismissedSuggestions`.
- `manualLinkedRows` foi ampliada: inclui vínculos com órfãos e vínculos confirmados a partir de sugestões (`matches[i]?.best && dismissedSuggestions.has(i)`).
- Seção "Vinculadas manualmente" agora renderiza também em `isCardMode` (removido `!isCardMode`).
- `renderManualLinkRow` foi generalizado: usa órfão quando existe; senão faz fallback para `matches[i].best.candidate`.
- Sub-seção duplicada "Resolvidos com É o mesmo" dentro de "Só no sistema" foi removida; badge no header agora mostra "N resolvido(s) acima".

## Próximo passo (se aprovado)
1. Validar no preview clicando em "É o mesmo" nas duas seções (Provável e Só no sistema) e confirmar por screenshot que:
   - A linha some do local do clique.
   - Aparece no bloco "Vinculadas manualmente" acima.
   - Contadores de cobertura e badges de "Só no sistema" atualizam.
   - O botão "Desfazer" restaura a linha à origem.
2. Se algum caso ainda falhar, ajustar filtros (`manualLinkedRows`, `newRows`) para cobrir o cenário faltante.

Nenhum outro código será alterado até a validação.
