
## Objetivo

Corrigir 2 regressões no `supabase/functions/whatsapp-webhook/index.ts`:

1. Quando a EVA lista opções numeradas de conta/cartão, a resposta `1`, `2`, `3` etc. deve selecionar corretamente a opção.
2. Em boleto de despesa, a EVA não deve perguntar banco/conta.

## O que encontrei

### 1) A lista é numerada, mas o parser da resposta não aceita número
No fluxo `choose_account` (linhas ~720-780), a resposta do usuário é comparada apenas por texto/nome:

- conta: `a.name.toLowerCase().includes(userChoice)`
- carteira: `w.name.toLowerCase().includes(userChoice)`
- cartão: nome e final do cartão

Hoje não existe tratamento para:
- `1`
- `2`
- `3`

Por isso o usuário responde `1` e cai em:
```ts
❓ Não entendi qual conta...
```

### 2) A mensagem pede nome, apesar de exibir números
As mensagens atuais mostram lista numerada, mas instruem:
- `Responda com o nome da conta...`
- `Responda com o nome do cartão...`

Isso contradiz o UX que vocês já querem usar no WhatsApp.

### 3) A regra de boleto está incompleta
Existe regra de prompt dizendo:
- boleto de despesa não precisa perguntar conta

Mas no código real (linhas ~2299-2355), o `isBoletoCompra` só evita erro quando `totalOptions === 0`.

Se houver 1 ou várias contas/carteiras no contexto, o fluxo ainda:
- autoatribui uma conta, ou
- cria `choose_account`

Ou seja: boleto de despesa continua entrando na lógica de seleção de conta quando não deveria.

## Plano de implementação

### Etapa 1 — Corrigir seleção por número no pending action
No bloco `pendingAction.action_type === "choose_account"`:

- detectar se `trimmedMsg` é um número inteiro positivo
- montar a mesma ordem exibida ao usuário:
  - para conta: primeiro `allAccs`, depois `allWlts`
  - para cartão: `allCcs`
- converter `1` em índice `0`, `2` em índice `1`, etc.
- se o índice existir, preencher:
  - `matchedBankId`
  - `matchedWalletId`
  - `matchedCardId`
  - `matchedCardBankId` quando for cartão

Fallback:
- se não for número válido, continuar com matching por nome/texto como hoje

Resultado esperado:
- usuário responde `1`
- EVA entende e segue com o lançamento corretamente

### Etapa 2 — Atualizar os textos para refletir seleção numérica
Ajustar as mensagens de escolha para algo como:

- conta:
  - `Responda com o número da opção ou com o nome da conta.`
- cartão:
  - `Responda com o número da opção ou com o nome do cartão.`

E no erro de retry:
- trocar `responda com o nome exato da conta`
- por algo como `responda com o número da opção ou o nome exato`

Isso deixa o texto alinhado com o comportamento real.

### Etapa 3 — Boleto de despesa deve sair do fluxo de conta antes
No trecho onde resolve conta/carteira principal (linhas ~2299+):

- calcular `isBoletoCompra` antes de qualquer autoatribuição/pergunta
- se for:
  - `txType === "despesa"`
  - `paymentMethod === "Boleto"` ou `aiParsed.payment_method === "boleto"`

então:
- não autoatribuir conta única
- não abrir `choose_account`
- manter `bankAccountId = null` e `walletId = null`
- seguir para criação do lançamento normalmente

Isso vale mesmo se existirem várias contas/carteiras cadastradas.

### Etapa 4 — Garantir consistência no bloqueio final
Manter o safeguard final:
```ts
if (!bankAccountId && !walletId && !creditCardId && !isBoletoCompraFinal)
```

Mas alinhar a variável de boleto com a mesma regra usada no fluxo principal, para não haver divergência entre:
- decisão de perguntar
- decisão de bloquear

## Arquivo afetado

- `supabase/functions/whatsapp-webhook/index.ts`

## Resultado esperado

Depois da correção:

1. Se a EVA mandar:
```text
1 - Banco do Brasil
2 - Dinheiro Clínica PF (carteira)
```

e o usuário responder:
```text
1
```

a conta 1 será selecionada corretamente.

2. Se responder:
```text
2
```

a carteira 2 será selecionada corretamente.

3. Em boleto de despesa:
- a EVA não pergunta banco/conta
- registra sem conta
- o usuário pode associar depois

## Detalhes técnicos

### Ajuste de parsing numérico
Criar uma lista ordenada com tipo + id para refletir exatamente a ordem exibida na mensagem.

Exemplo:
```ts
const numericChoice = Number(trimmedMsg);
if (Number.isInteger(numericChoice) && numericChoice >= 1) {
  // usa mesma ordem exibida ao usuário
}
```

### Ordem que precisa bater com a UI
Para `bank_account`:
```text
1..N = contas bancárias
N+1..M = carteiras
```

Para `credit_card`:
```text
1..N = cartões exibidos no cardList
```

### Ajuste de negócio para boleto
O bypass de boleto precisa acontecer antes do bloco:
- autoatribuição da única conta
- criação do pending action `choose_account`

Hoje ele está tarde demais e por isso a EVA ainda pergunta conta.
