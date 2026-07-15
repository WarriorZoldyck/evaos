## Verificação

Revisei `src/components/lancamentos/PaymentMethodFields.tsx` e o comportamento pedido **já está ativo** hoje:

- `showBankAccount` só aparece para: `PIX`, `Boleto`, `Transferência`, `Cheque`, `Depósito`, `Débito Automático` (e Cartão de Débito em despesa). **Dinheiro não está nessa lista**, então o campo Conta Bancária **não aparece** quando o método é Dinheiro.
- `showWallet` é `paymentMethod === "Dinheiro"` — só Dinheiro mostra Carteira.

Ou seja: ao escolher **Dinheiro**, o formulário exibe **apenas o campo Carteira**, nunca Conta Bancária. Isso já garante o que você pediu (evita duplicar, mantém o valor só na carteira).

## Proposta

Nenhuma mudança de código necessária.

Se você estiver vendo Conta Bancária aparecer junto com Carteira ao selecionar Dinheiro em algum lugar específico (ex.: em uma tela de edição, ou vindo do WhatsApp/EVA), me diga onde reproduziu que eu investigo esse fluxo específico — porque no formulário padrão de Novo Lançamento a regra já está correta.
