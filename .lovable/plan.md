## Objetivo
Fazer o botão "É o mesmo" refletir a vinculação imediatamente na UI durante a conciliação da importação.

## Diagnóstico (a confirmar em build mode com leitura do arquivo)
Provável causa: `handleMarkSame` em `ReconcileStep.tsx` atualiza `linkedOrphans`, mas o item continua aparecendo em "Só no sistema" (ou "Provável") porque as listas derivadas não filtram por `linkedOrphans`, e/ou o contador `coverageMatched` não incrementa. Sem feedback visual, o usuário acha que o botão não faz nada.

## Passos
1. Ler `src/components/lancamentos/import/ReconcileStep.tsx` para confirmar como `linkedOrphans`, a seção "Provável / Só no sistema" e os contadores são calculados.
2. Ajustar o handler `handleMarkSame` para:
   - Remover o item da lista "Só no sistema" e da lista "Provável" imediatamente (filtrando pelos IDs em `linkedOrphans`).
   - Mover o par para a seção "Resolvidos com É o mesmo" já existente, com botão "Desfazer".
   - Atualizar `coverageMatched` e o resumo do rodapé (`Importar N`) para contar o vínculo.
3. Garantir que, ao clicar em "Desfazer", o item volte para sua seção original e o contador seja revertido.
4. Verificar que o estado `linkedOrphans` persiste até o submit e é enviado como par conciliado na importação (sem duplicar criação).
5. Validar em preview: clicar "É o mesmo" → linha some da seção original, aparece em "Resolvidos", contador sobe; "Desfazer" reverte.

## Escopo
- Apenas `src/components/lancamentos/import/ReconcileStep.tsx` (frontend/UI).
- Não alterar `useImportMatching`, backend, nem outros botões ("Criar novo", "Outra compra", "Manter só do extrato").
