## Problema

No formulário de lançamento, ao escolher **PIX** como forma de pagamento, o sistema mostra o campo **Carteira** como opção (além de Conta Bancária). PIX sempre sai/entra de uma conta bancária — nunca de uma carteira física (dinheiro em espécie). Isso confundiu o usuário `gurimag77@gmail.com`, que precisou selecionar carteira ao fazer uma transferência PIX.

## Correção

**Arquivo:** `src/components/lancamentos/PaymentMethodFields.tsx`

Ajustar a regra `showWallet` para exibir o campo Carteira **apenas** quando o método for `Dinheiro`:

```ts
// antes
const showWallet =
  paymentMethod === "Dinheiro" ||
  paymentMethod === "PIX";

// depois
const showWallet = paymentMethod === "Dinheiro";
```

O campo Conta Bancária já é exibido para PIX (via `showBankAccount`), então o usuário continuará conseguindo selecionar a conta de origem/destino normalmente.

## Fora de escopo

- Não mexer em lançamentos PIX antigos já salvos com `wallet_id` — permanecem como estão.
- Sem mudanças em outros métodos (Dinheiro continua permitindo carteira; Boleto, Transferência etc. continuam só com conta bancária).
- Sem alterações no fluxo do WhatsApp/EVA nem no schema do banco.
