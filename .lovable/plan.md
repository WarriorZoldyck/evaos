

# Filtro de Cartões: Mostrar apenas cartão pai com filhos agrupados

## Problemas

1. **Dropdown de contas** lista todos os cartões (pai e filhos) no mesmo nível. Deveria mostrar apenas cartões pai (ou standalone). Cartões filhos ficam escondidos até expandir/selecionar o pai.

2. **Query do filtro** filtra por `credit_card_id = X` exato. Quando o usuário seleciona um cartão pai, deveria trazer transações do pai E de todos os filhos.

## Correções

### 1. TransactionFilters.tsx — Dropdown hierárquico de cartões

**Props**: adicionar `parent_card_id` ao tipo de `creditCards`.

**Lógica**: separar cartões em pais (sem `parent_card_id`) e filhos (com `parent_card_id`). No dropdown:
- Mostrar apenas cartões pai/standalone como opções principais com valor `card:ID`
- Abaixo de cada pai, indentar os filhos com prefixo visual (ex: `  ↳ VITORIA •8021`) com valor `card-child:ID`
- Adicionar opção `card-parent:ID` = "Ver todos do grupo" para o pai

Resultado visual no Select:
```
💳 PAULA REGINA (7014) •7014        ← seleciona PAI + todos filhos
  ↳ VITORIA (8021) •8021            ← seleciona só este filho
  ↳ PAULARS (5178) •5178
  ↳ GEOVANNA (7239) •7239
```

### 2. useTransactions.ts — Query inclui filhos quando filtra por pai

No bloco `if (accType === "card")` (linha ~253):
- Se o filtro for `card:ID` E esse ID é um cartão pai (tem filhos), buscar com `.in("credit_card_id", [paiId, ...filhosIds])` em vez de `.eq("credit_card_id", accId)`
- Se for um cartão filho individual, manter `.eq("credit_card_id", accId)`

Para isso, o hook precisa consultar `creditCards` (que já tem `parent_card_id`) para montar a lista de IDs filhos.

### 3. Lancamentos.tsx — Passar creditCards com parent_card_id

Já passa `creditCards` que vem do hook com `parent_card_id`. Só precisa ajustar o tipo na interface de `TransactionFilters`.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/lancamentos/TransactionFilters.tsx` | Tipo de creditCards ganha `parent_card_id`, dropdown hierárquico |
| `src/hooks/useTransactions.ts` | Query de filtro por cartão pai inclui filhos via `.in()` |

## Resultado esperado

- Dropdown mostra cartões organizados hierarquicamente
- Selecionar cartão pai → mostra transações de todos os cartões do grupo
- Selecionar cartão filho individual → mostra só as dele
- A tabela continua agrupando hierarquicamente como já faz hoje

