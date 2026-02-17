

## Liquidacao inteligente com tratamento de diferenca e redistribuicao de parcelas

### Contexto

Atualmente, ao liquidar um lancamento e alterar o valor, o sistema simplesmente salva o novo valor sem questionar o que acontece com a diferenca. O usuario precisa de um fluxo similar ao pagamento de fatura de cartao de credito, onde:

1. Se pagar **menos** que o previsto: perguntar o que fazer com o saldo restante
2. Se pagar **mais** que o previsto: perguntar como registrar o excedente
3. Em **series parceladas**: ao alterar o valor de uma parcela, redistribuir automaticamente o restante entre as demais parcelas pendentes

### Alteracoes

**1. Reformular `src/components/dashboard/LiquidateModal.tsx`**

Adicionar um fluxo em etapas quando o valor final difere do valor original:

- **Etapa 1 (atual)**: Dados da liquidacao (valor, data, conta, observacoes)
- **Etapa 2 (nova - so aparece se valor mudou)**: Tratamento da diferenca

Quando o valor e **menor** (pagamento parcial):
- "Descartar a diferenca" (apenas registra o valor menor)
- "Criar lancamento pendente com o saldo restante" (cria um novo lancamento pendente com o valor da diferenca, na mesma categoria)
- "Aplicar juros/multa sobre o saldo" (cria lancamento pendente com juros configuravel)
- Para series: "Redistribuir saldo entre parcelas restantes" (divide a diferenca pelas proximas parcelas pendentes da serie)

Quando o valor e **maior** (pagamento com acrescimo):
- "Registrar apenas o valor pago" (salva o valor maior, sem acao extra)
- "Criar lancamento separado para o excedente" (ex: juros, multa) com campo para descricao e categoria

**2. Redistribuicao de parcelas em series (`LiquidateModal` + `useTransactions`)**

Quando o lancamento faz parte de uma serie (`series_id` preenchido) e o valor e alterado:
- Buscar todas as parcelas pendentes restantes da serie
- Calcular o novo saldo total (original_amount - soma dos valores ja liquidados - novo valor)
- Distribuir o saldo igualmente entre as parcelas pendentes restantes
- Atualizar os valores das parcelas via `updateTransaction`

Exemplo pratico:
- Serie de R$ 1.000 em 4x de R$ 250
- Parcela 1: cliente paga R$ 400 de entrada
- Sistema redistribui: parcelas 2, 3, 4 ficam R$ 200 cada

**3. Novo metodo no hook `src/hooks/useTransactions.ts`**

Adicionar `redistributeSeriesAmounts`:
```typescript
const redistributeSeriesAmounts = async (
  seriesId: string,
  excludeId: string,
  newTotalRemaining: number
) => {
  // Busca parcelas pendentes da serie (exceto a atual)
  // Divide newTotalRemaining igualmente entre elas
  // Atualiza cada uma
};
```

### Fluxo visual da liquidacao reformulada

```text
[Valor original: R$ 500,00]
[Valor final: R$ 350,00]  --> detecta diferenca de R$ 150,00

--> "O valor e menor que o previsto. O que fazer com os R$ 150,00 restantes?"

( ) Descartar - registrar apenas R$ 350,00
( ) Criar lancamento pendente com R$ 150,00
( ) Aplicar juros/multa: [__]% --> R$ 150,00 + juros = R$ ___
( ) Redistribuir entre parcelas restantes (so aparece se for serie)
    --> Parcelas 3, 4, 5 passam de R$ 500 para R$ 550 cada
```

### Arquivos modificados

- `src/components/dashboard/LiquidateModal.tsx` -- fluxo em etapas com tratamento de diferenca
- `src/hooks/useTransactions.ts` -- novo metodo `redistributeSeriesAmounts`

