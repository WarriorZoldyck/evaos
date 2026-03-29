
# Diagnóstico da importação multi-cartão da Paula

## O que os logs mostram
- A edge function `parse-bank-statement` está funcionando corretamente.
- Ela extraiu **115 transações** da fatura.
- Breakdown no log:
  - **7014: 92**
  - **5178: 13**
  - **7239: 7**
  - **8021: 3**

Ou seja: a IA reconheceu os cartões da fatura. O problema não está na leitura do PDF.

## Causa raiz encontrada
### 1. O modal colapsa cartões filhos no cartão principal
Em `src/components/lancamentos/ImportStatementModal.tsx`, na detecção por linha, o código faz isso:

```ts
if (card) matchedCardId = card.parent_card_id || card.id;
```

Na prática:
- 5178 vira 7014
- 7239 vira 7014
- 8021 vira 7014

Então a fatura multi-cartão é tratada como se fosse de **um único cartão**.

### 2. Por isso os lançamentos “não aparecem por cartão”
Como tudo vira o pai:
- `isMultiCard` tende a ficar falso
- a coluna “Cartão” não representa os filhos corretamente
- os lançamentos acabam indo todos para o **cartão principal 7014**

### 3. A chave de deduplicação não considera o cartão
Hoje o `external_id` é gerado assim:

```ts
import_${r.date}_${r.amount}_${r.description...}
```

Ele **não inclui o cartão** nem os 4 dígitos detectados.

Resultado:
- se já existe um lançamento com mesma data + valor + descrição
- mesmo que seja de outro cartão da mesma fatura
- o sistema entende como duplicado e ignora

### 4. O hook reforça esse descarte
Em `src/hooks/useTransactions.ts`, `createMultipleTransactions()` consulta `external_id` existente e pula os itens repetidos antes de inserir. Além disso, há índice único no banco por `(user_id, external_id)`.

## Por que a Paula viu “13 lançados e 102 ignorados”
Porque:
1. a fatura foi lida com **115 transações**
2. os cartões filhos foram convertidos para o pai
3. a deduplicação comparou tudo sem distinguir cartão
4. só **13** ficaram com `external_id` “novo”
5. os outros **102** bateram como já existentes e foram ignorados

## O que precisa ser corrigido
### 1. Preservar o cartão real da transação
- `matched_card_id` deve guardar o **cartão detectado de verdade**
- não o `parent_card_id`
- se precisar, criar derivação separada só para exibir o principal

### 2. Corrigir a UI de multi-cartão
- detectar multi-cartão com base nos **cartões reais detectados**
- exibir cada linha com seu cartão correspondente
- mostrar resumo por cartão no preview (quantidade + total)

### 3. Gravar cada lançamento no cartão correto
No `handleImport`:
- cada linha deve receber seu `credit_card_id` real
- pai e filhos podem compartilhar conta bancária, mas o lançamento precisa ficar no cartão certo

### 4. Corrigir a deduplicação
Gerar `external_id` incluindo o cartão, por exemplo:
```ts
import_card_${cardId || digits}_${date}_${amount}_${descricaoNormalizada}
```

Assim:
- compras iguais em cartões diferentes não colidem
- reimportação da mesma fatura continua protegida
- o índice único atual continua válido

### 5. Corrigir o lote já importado errado
Depois da correção:
- revisar os lançamentos que foram parar no 7014 indevidamente
- excluir o lote incorreto
- reimportar a fatura

## Validação esperada após a correção
- Preview deve mostrar os **4 cartões** detectados: 7014, 5178, 7239, 8021
- As **115 transações** devem aparecer distribuídas por cartão
- A importação deve lançar cada item no cartão correto
- Reimportar o mesmo PDF depois deve ignorar apenas duplicatas do **mesmo cartão**, não dos outros

## Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `src/components/lancamentos/ImportStatementModal.tsx` | Parar de colapsar filho no pai; exibir cartão real por linha; gerar `external_id` com cartão |
| `src/hooks/useTransactions.ts` | Manter dedupe, mas com a nova chave por cartão |
| `src/pages/Lancamentos.tsx` | Sem mudança estrutural grande; manter envio de todos os cartões para o modal |
