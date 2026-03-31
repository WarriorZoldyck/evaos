

# Revisão da Importação Multi-Cartão — Problemas Encontrados

## Bug 1: Categoria salva como UUID em vez de nome
**Linha 322** do `ImportStatementModal.tsx`:
```typescript
category: defaultCategory || "Sem Categoria"
```
O `defaultCategory` vem de um `<Select>` cujo `value` é `c.id` (UUID). Porém, a coluna `category` na tabela `transactions` espera o **nome** da categoria (string texto), não o UUID. Resultado: transações importadas ficam com uma categoria ilegível/não reconhecida pelo sistema.

**Correção**: Buscar o nome da categoria selecionada:
```typescript
const catName = rootCategories.find(c => c.id === defaultCategory)?.name || "Sem Categoria";
// usar catName no map
```

## Bug 2: Transações sem match de cartão ficam sem cartão em modo multi-card
**Linha 303-304**:
```typescript
const cardId = isMultiCard
  ? (r.matched_card_id || targetCard || null)  // targetCard está vazio em multi-card!
  : (importType === "cartao" ? targetCard : null);
```
Em modo multi-card, `targetCard` nunca é setado (o select de cartão só aparece quando `!isMultiCard`). Transações sem `matched_card_id` recebem `credit_card_id = null`.

**Correção**: Para transações sem match em modo multi-card, atribuir ao cartão principal (pai) da fatura. Podemos derivar o cartão pai do primeiro `detectedCards` que não tenha `parent_card_id`, ou do cartão com mais transações.

## Bug 3: Prompt da IA pode não processar faturas muito grandes
O `max_tokens: 65000` pode não ser suficiente para faturas com 100+ transações. O JSON de 115 transações pode ter ~50k tokens. Se truncar, a lógica de salvage recupera parcialmente mas perde transações do final.

**Não precisa de mudança agora** — já tem lógica de salvage. Mas vale monitorar.

## Resumo das Correções

| Arquivo | Correção |
|---------|----------|
| `ImportStatementModal.tsx` | Linha 322: usar nome da categoria em vez de UUID |
| `ImportStatementModal.tsx` | Linha 303: fallback para cartão pai quando sem match em multi-card |

Impacto: 2 bugs que afetam diretamente a qualidade dos dados importados. Correção simples, sem risco de quebrar outros fluxos.

