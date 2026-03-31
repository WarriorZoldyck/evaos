

# Incluir Conta no Feedback do WhatsApp

## Problema
O feedback enviado ao usuário após lançamento só mostra a conta quando é cartão de crédito. Quando é conta bancária ou carteira, a informação não aparece.

## Correção

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**1. Transação única (linhas ~2906-2907)**
Alterar a lógica de `accountDisplay` para cobrir os 3 casos:
- Se `creditCardId` → mostrar nome do cartão
- Se `bankAccountId` → buscar nome da conta em `contextAccounts`
- Se `walletId` → buscar nome da carteira em `contextWallets`

```typescript
const cardName = creditCardId ? contextCards.find(c => c.id === creditCardId)?.name : null;
const bankName = bankAccountId ? contextAccounts.find(a => a.id === bankAccountId)?.name : null;
const walletName = walletId ? contextWallets.find(w => w.id === walletId)?.name : null;
const accountDisplayName = cardName || bankName || walletName;
const accountDisplay = accountDisplayName ? `\n🏦 ${accountDisplayName}` : "";
```

**2. Feedback de parcelas (linha ~2849)**
Adicionar a mesma informação de conta no feedback de parcelas, que hoje não inclui nada.

