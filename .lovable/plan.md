

## Adicionar filtro por Cartao de Credito em Lancamentos + Liquidacao da fatura pelo filtro

### Contexto

Atualmente, o filtro de contas em Lancamentos permite filtrar por conta bancaria e carteira, mas nao por cartao de credito. O usuario precisa poder filtrar por cartao para ver todas as transacoes daquele cartao, ver o valor total da fatura, e liquidar o cartao inteiro de uma vez.

### Alteracoes

**1. Adicionar cartoes de credito no filtro de contas (`src/components/lancamentos/TransactionFilters.tsx`)**

- Receber `creditCards` como nova prop (lista de `{ id: string; name: string }[]`)
- No `Select` de "Conta / Carteira", adicionar os cartoes de credito como opcoes com prefixo `card:` (ex: `card:uuid`)
- Exibir com icone de cartao (emoji ou texto "Cartao")
- Condicionar a visibilidade do select para incluir cartoes: `bankAccounts.length > 0 || wallets.length > 0 || creditCards.length > 0`

**2. Suportar filtro `card:id` no hook (`src/hooks/useTransactions.ts`)**

- No bloco de `filters.accountId` (onde ja trata `bank:` e `wallet:`), adicionar suporte para `card:`:
  ```
  } else if (accType === "card") {
    query = query.eq("credit_card_id", accId);
  }
  ```

**3. Passar `creditCards` ao componente de filtros (`src/pages/Lancamentos.tsx`)**

- Adicionar prop `creditCards={creditCards}` ao `<TransactionFilters />`
- Quando o filtro ativo for um cartao (`filters.accountId` comeca com `card:`), exibir um botao "Pagar Fatura" ao lado do filtro ou no header, que abre o `CreditCardBillPaymentModal` para aquele cartao

**4. Botao "Pagar Fatura" contextual na pagina de Lancamentos**

- Quando `filters.accountId` comeca com `card:`, mostrar um botao "Pagar Fatura" no header da pagina (ao lado de "Novo Lancamento")
- Ao clicar, abre o `CreditCardBillPaymentModal` pre-selecionado com o cartao filtrado
- Isso permite ao usuario: filtrar pelo cartao, ver todas as parcelas, e dar baixa na fatura inteira

### Fluxo do usuario

```text
1. Filtros > Seleciona "Cartao Nubank" no select de contas
2. Lista mostra apenas transacoes daquele cartao
3. Aparece botao "Pagar Fatura" no header
4. Clica em "Pagar Fatura" --> abre CreditCardBillPaymentModal
5. Revisa a fatura, escolhe valor, paga integral ou parcial
```

### Arquivos modificados

1. `src/components/lancamentos/TransactionFilters.tsx` -- adicionar creditCards como prop e opcoes no select
2. `src/hooks/useTransactions.ts` -- suportar filtro `card:id`
3. `src/pages/Lancamentos.tsx` -- passar creditCards ao filtro + botao "Pagar Fatura" contextual

