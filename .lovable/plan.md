

# Fix: Card Flip Não Mantém Estado

## Problema
Ao clicar no cartão 3D para ver o verso, ele gira e volta imediatamente. O click event no container do cartão está propagando para o `DialogContent` do Radix, que interpreta como interação externa e causa um ciclo de re-render que reseta o estado `isFlipped`.

## Solução
Em `src/components/contas/CreditCardFormModal.tsx`:

1. Adicionar `e.stopPropagation()` no onClick do container do cartão (linha 118) para impedir a propagação do evento para o Dialog
2. Adicionar `onPointerDownOutside` e `onInteractOutside` no `DialogContent` com `e.preventDefault()` para evitar que cliques internos sejam interpretados como cliques externos
3. Separar as áreas clicáveis — o flip deve ser acionado apenas ao clicar na "face" do cartão, não nos inputs dentro dele (adicionar `e.stopPropagation()` nos inputs para não disparar o flip ao interagir com campos de formulário)

