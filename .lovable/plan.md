## Mudanças no `TransactionFormModal.tsx`

### 1. Mover Status para antes de Observações
Remover o bloco `FormField name="status"` do topo do formulário (linhas ~1323-1344) e reinserir logo **antes** do bloco de Observações (linha ~1903).

### 2. Auto-marcar Status = "Pago" para métodos à vista
Adicionar um `useEffect` que observa `payment_method` e ajusta o default do status:

- **Pago** quando `payment_method` for: `Dinheiro`, `PIX`, `Transferência`, `Débito Automático`.
- **Pendente** para os demais (Boleto, Cartão de Crédito, Cartão de Débito, Cheque, Depósito, etc.).

Regras:
- Só aplica em criação (não sobrescreve o status em edição de lançamento existente).
- Só atualiza automaticamente se o usuário ainda não tiver alterado manualmente o status desde que abriu o modal (uso de um ref `statusTouchedRef`) — se ele mudou pra "Pendente" de propósito, respeitamos.

## Fora de escopo
- Sem mudanças em schema, validação, ou no fluxo de transferência.
- Sem mudança no valor default inicial (`Pendente` continua sendo o fallback quando ainda não há `payment_method` escolhido).
