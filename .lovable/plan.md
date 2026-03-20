

## Problema

A EVA detectou corretamente que a NF pertence à empresa "IMPLANTES BR LTDA", mas essa empresa **não tem nenhuma conta bancária cadastrada**. O código que permite boletos de compra sem conta (linha 1757-1760) só executa quando `totalOptions > 1`. Quando `totalOptions === 0`, o fluxo cai direto no bloqueio da linha 2068-2076 que rejeita a transação.

## Solução

Duas correções no `supabase/functions/whatsapp-webhook/index.ts`:

### 1. Permitir boleto de compra sem conta mesmo com 0 contas

Mover a verificação de boleto de compra para **antes** da checagem de `totalOptions`, ou adicionar a mesma condição no bloco `totalOptions === 0`. O boleto de compra (despesa) deve sempre prosseguir sem conta, independentemente de quantas contas existem no contexto.

### 2. Remover bloqueio absoluto para despesas via boleto

No bloco final (linha 2068-2076) que verifica `!bankAccountId && !walletId && !creditCardId`, adicionar uma exceção: se for boleto de compra (despesa), permitir continuar sem conta.

### Mudanças técnicas

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

- **Linha ~1747-1806**: Reestruturar a lógica para que o check de `isBoletoCompra` ocorra **antes** do `if (totalOptions === 1)`, assim:
  - Se é boleto de compra → skip (log e continua sem conta)
  - Senão → lógica atual de 1 conta / múltiplas contas / perguntar
  
- **Linha ~2068-2076**: Adicionar exceção ao bloqueio: se `txType === "despesa"` e método é boleto, não bloquear — permitir lançamento sem conta.

- **Re-deploy** da edge function após a correção.

