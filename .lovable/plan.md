

## Correção do DRE + Agrupamento por Cartão em Lançamentos

### 1. Correção do alinhamento no DRE

**Problema**: As linhas de categoria estão envolvidas por `<span>` (linhas 51 e 93 de `DRETable.tsx`), o que quebra a estrutura de tabela HTML. O `<tbody>` espera `<tr>` como filhos diretos -- um `<span>` intermediário faz o navegador "desmontar" o layout da tabela, desalinhando os valores das datas.

**Solução**: Trocar `<span key={...}>` por React Fragment `<Fragment key={...}>` (ou a forma curta com key usando `Fragment` importado do React).

**Arquivo**: `src/components/relatorios/DRETable.tsx`
- Linha 51: `<span key={row.categoryId}>` vira `<Fragment key={row.categoryId}>`
- Linha 93: `</span>` vira `</Fragment>`

---

### 2. Agrupamento de transacoes por cartao de credito na listagem

**Objetivo**: Em vez de listar cada parcela de cartao como lancamento individual, agrupar transacoes do mesmo cartao de credito em uma linha-resumo (mostrando o total do cartao), e ao clicar, expandir para ver as parcelas individuais.

**Arquivo principal**: `src/components/lancamentos/TransactionTable.tsx`

Alteracoes:
- Antes de renderizar, agrupar transacoes que possuem `credit_card_id` por cartao
- Criar uma linha-grupo colapsavel para cada cartao, exibindo:
  - Icone de cartao + nome do cartao
  - Quantidade de lancamentos agrupados
  - Soma total dos valores
  - Chevron para expandir/colapsar
- Ao expandir, exibir as transacoes individuais daquele cartao com indentacao visual
- Transacoes sem cartao (banco, carteira) continuam listadas individualmente como hoje
- Manter a opcao de "Liquidar" no nivel do grupo (liquidar toda a fatura do cartao de uma vez, abrindo o `CreditCardBillPaymentModal`)
- Manter acoes individuais (editar, duplicar, excluir, liquidar) em cada parcela expandida

Logica de agrupamento:
```text
transactions.forEach(t => {
  if (t.credit_card_id) {
    groups[t.credit_card_id].push(t)
  } else {
    directList.push(t)
  }
})

Renderizar intercalado na ordem cronologica:
- Linha de grupo do cartao (primeiro payment_date do grupo)
- Linhas individuais sem cartao
```

---

### 3. Sobre a edicao de parcelas com redistribuicao

**Status atual**: A funcionalidade de redistribuicao ja foi implementada no `LiquidateModal` -- ao liquidar com valor diferente, o sistema pergunta o que fazer com a diferenca, incluindo a opcao "Redistribuir entre parcelas restantes".

**Melhoria proposta**: Adicionar uma previa visual das parcelas afetadas no Step 2 do `LiquidateModal`, quando a opcao "redistribute" estiver selecionada. Atualmente so mostra "X parcelas serao atualizadas para R$ Y cada". A melhoria:

- Buscar e exibir a lista completa das parcelas pendentes da serie
- Mostrar uma mini-tabela com:
  - Numero da parcela
  - Valor atual
  - Novo valor (apos redistribuicao)
- Isso da visibilidade total ao usuario antes de confirmar

**Arquivo**: `src/components/dashboard/LiquidateModal.tsx`

Alteracoes:
- No `useEffect` que busca `pendingInstallmentsCount`, buscar tambem os dados completos das parcelas pendentes (id, installment_number, amount, payment_date)
- Armazenar em um novo estado `pendingInstallments`
- Quando `differenceAction === "redistribute"`, renderizar uma mini-tabela mostrando cada parcela com valor atual vs. novo valor
- Calcular o novo valor em tempo real conforme o usuario altera o `finalAmount`

---

### Arquivos a modificar

1. `src/components/relatorios/DRETable.tsx` -- corrigir span para Fragment
2. `src/components/lancamentos/TransactionTable.tsx` -- agrupamento por cartao
3. `src/components/dashboard/LiquidateModal.tsx` -- preview das parcelas na redistribuicao

