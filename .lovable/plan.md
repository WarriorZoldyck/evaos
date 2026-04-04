

# Revisão do Agrupamento Hierárquico de Cartões

## Problemas identificados no código atual

### 1. Cálculo do total não desconta estornos (receitas)
Linhas 497 e 530: `totalAmount` soma `tx.amount` de todas as transações sem considerar o tipo. Estornos (`type === "receita"`) deveriam ser subtraídos do total, não somados. Resultado: o valor exibido no cabeçalho do cartão pai fica inflado.

```text
Hoje:    despesa R$500 + estorno R$50 = R$550 (errado)
Correto: despesa R$500 - estorno R$50 = R$450
```

### 2. Display sempre mostra sinal negativo
Linha 357: o header exibe `- {formatCurrency(group.totalAmount)}` sem considerar que o net pode ser positivo (mais estornos que despesas) ou que receitas devem abater o total.

### 3. Cartão filho órfão pode aparecer como standalone
Se um cartão filho tem transações mas o `groupKey` (parent_card_id) não está em `parentCardIds` (porque o pai não tem filhos cadastrados no array `creditCards` filtrado por empresa), ele cai no bloco standalone (linha 534) e aparece separado em vez de agrupado.

## Correções

### Arquivo: `src/components/lancamentos/TransactionTable.tsx`

**1. Corrigir cálculo de totalAmount para considerar tipo**
Nos pontos onde calcula `totalAmount` (linhas ~497, ~509, ~530, ~538):
```typescript
// Em vez de: txns.reduce((s, tx) => s + tx.amount, 0)
// Usar:
txns.reduce((s, tx) => s + (tx.type === "receita" ? -tx.amount : tx.amount), 0)
```

**2. Corrigir display do header para mostrar net**
No `CardGroupHeader`, exibir o valor absoluto do net com sinal adequado:
- Se net > 0 (mais despesas): exibir em vermelho com `-`
- Se net < 0 (mais estornos): exibir em verde com `+`
- Se net === 0: exibir neutro

**3. Garantir que filhos sempre agrupem sob o pai**
Reforçar a lógica de `parentCardIds` para incluir qualquer cartão que tenha `parent_card_id` definido, e garantir que o pai sempre apareça como grupo hierárquico mesmo sem transações próprias.

**4. Manter contagem de lançamentos precisa**
O badge de contagem (`txCount`) no header do pai deve mostrar o total real de transações únicas (sem duplicação entre pai e filhos).

## Resultado esperado

```text
┌─ 💳 VISA Unique (7014) — Total: R$ 20.739,08 — 47 lançamentos
│  ├─ 💳 PAULA (7014) — R$ 12.500,00 — 25 lançamentos
│  │  └─ [transações individuais]
│  ├─ 💳 VITORIA (8021) — R$ 3.200,00 — 8 lançamentos
│  │  └─ [transações individuais]
│  ├─ 💳 PAULARS (5178) — R$ 2.800,00 — 9 lançamentos
│  │  └─ [transações individuais]
│  └─ 💳 GEOVANNA (7239) — R$ 2.239,08 — 5 lançamentos
│     └─ [transações individuais]
```

- Cada transação aparece uma única vez
- Total do pai = soma dos subtotais dos filhos (incluindo o dele)
- Estornos abatidos corretamente
- Datas respeitam o período filtrado

