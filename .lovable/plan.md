

# Adicionar Cartão de Crédito na Importação de Extrato

## Problema
O modal de importação de extrato só permite selecionar "Conta Bancária" ou "Carteira" como destino. Falta a opção de selecionar um **Cartão de Crédito**, e quando o extrato contém números de cartão, o sistema deveria tentar identificar automaticamente o cartão correspondente pelos últimos 4 dígitos.

## O que muda

### 1. Props do `ImportStatementModal`
- Adicionar `creditCards: { id: string; name: string; last_four_digits: string | null }[]` nas props
- Passar `creditCards` a partir de `Lancamentos.tsx`

### 2. Seletor de destino com 3 tipos
No select "Conta destino", adicionar uma terceira seção com os cartões de crédito:
- 🏦 Contas bancárias (`bank:id`)
- 👛 Carteiras (`wallet:id`)
- 💳 Cartões de crédito (`card:id`) — **novo**

### 3. Auto-detecção de cartão
Após o parsing do arquivo, varrer as descrições das transações buscando sequências de 4 dígitos que correspondam ao `last_four_digits` de algum cartão cadastrado. Se encontrar match:
- Pré-selecionar automaticamente o cartão no select de destino
- Exibir um aviso: "Cartão [Nome] detectado automaticamente pelos últimos 4 dígitos"

### 4. Mapeamento na importação (`handleImport`)
Atualizar a lógica para que quando `accType === "card"`, o campo `credit_card_id` seja preenchido (em vez de `bank_account_id` ou `wallet_id`).

### 5. Página `Lancamentos.tsx`
Passar `creditCards` como prop para o `ImportStatementModal`.

## Arquivos afetados
- `src/components/lancamentos/ImportStatementModal.tsx` — nova prop, select com cartões, auto-detecção, mapeamento
- `src/pages/Lancamentos.tsx` — passar `creditCards` ao modal

