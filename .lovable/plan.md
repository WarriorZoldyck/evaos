

## Problema

A lógica atual trata **todo** boleto de compra (despesa) como "sem conta" — pula direto a seleção de conta. Mas a IMPLANTES BR LTDA **tem** contas e carteiras cadastradas (1 conta + 1 carteira por empresa). A EVA deveria perguntar em qual conta registrar quando existem contas disponíveis, e só pular quando realmente não houver nenhuma.

## Solução

Inverter a ordem da verificação: primeiro checar se há contas disponíveis no contexto, e só aplicar o bypass de "boleto de compra sem conta" quando `totalOptions === 0`.

## Mudanças técnicas

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

### Reestruturar bloco de seleção de conta (linhas ~1747-1803)

Lógica atual:
```
if isBoletoCompra → skip (sempre)
else → checar totalOptions
```

Nova lógica:
```
totalOptions = contextAccounts + contextWallets
if totalOptions === 1 → usar automaticamente
else if totalOptions > 1 → perguntar (para TODOS, incluindo boleto de compra)
else (totalOptions === 0):
  if isBoletoCompra → skip sem conta
  else → buscar contas de outros contextos e perguntar (ou erro)
```

Ou seja:
- Boleto de compra com contas disponíveis → pergunta normalmente qual conta
- Boleto de compra sem nenhuma conta → registra sem conta (bypass)
- Outros métodos sem conta → comportamento atual (perguntar/buscar cross-context)

### Re-deploy da edge function

