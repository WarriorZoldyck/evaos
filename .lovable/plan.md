

# Vincular Cartões (Cartão Principal + Cartões Virtuais)

## Contexto
Hoje cada cartão de crédito é independente. A proposta é permitir que um cartão seja vinculado a outro (ex: cartão virtual vinculado ao cartão físico principal), compartilhando o mesmo limite e conta bancária.

## O que muda

### 1. Migração no banco de dados
Adicionar uma coluna `parent_card_id` (uuid, nullable) na tabela `credit_cards` que referencia outro cartão da mesma tabela. Cartões com `parent_card_id = null` são cartões principais. Cartões com valor preenchido são "virtuais/vinculados".

```sql
ALTER TABLE credit_cards
  ADD COLUMN parent_card_id uuid REFERENCES credit_cards(id) ON DELETE SET NULL;
```

### 2. Formulário de criação/edição (`CreditCardFormModal.tsx`)
- Adicionar um campo opcional **"Vincular a cartão principal"** (Select) no verso do cartão (junto com fechamento, vencimento, etc.)
- Listar apenas cartões que NÃO são vinculados (onde `parent_card_id IS NULL`) e que não são o próprio cartão em edição
- Quando vinculado: herdar automaticamente `closing_day`, `due_day`, `bank_account_id` do cartão pai (campos ficam preenchidos mas editáveis caso o usuário queira sobrescrever)
- O `limit` do cartão virtual representa um sub-limite dentro do limite do pai (ou pode ser igual)

### 3. Interface de criação (`CreditCardForm` interface)
- Adicionar `parent_card_id?: string` ao tipo `CreditCardForm`

### 4. Hook `useAccounts.ts`
- Passar `parent_card_id` no `createCreditCard` e `updateCreditCard`

### 5. Listagem na página Contas (`Contas.tsx`)
- Na tabela de cartões, agrupar visualmente: cartões principais aparecem primeiro, cartões vinculados aparecem indentados logo abaixo do pai com um indicador visual (ex: ícone de link ou badge "Virtual")
- Adicionar coluna ou badge indicando "Vinculado a: [Nome do Pai]"

### 6. Componente 3D do cartão (`CreditCard3D.tsx`)
- Exibir no verso, quando vinculado, o nome do cartão principal
- Opcionalmente: visual ligeiramente diferente (badge "Virtual" ou cor mais clara)

## Fluxo do usuário
1. Usuário clica em "Novo Cartão"
2. Preenche nome e dígitos (frente)
3. Vira o cartão (verso) -- vê o novo campo "Vincular a cartão principal"
4. Se selecionar um cartão pai, os campos de fechamento, vencimento e conta bancária são preenchidos automaticamente com os dados do pai
5. Usuário pode ajustar se quiser e salvar

## Arquivos afetados
- **Migração SQL**: nova coluna `parent_card_id` em `credit_cards`
- `src/components/contas/CreditCardFormModal.tsx`: novo campo de vínculo + auto-preenchimento
- `src/components/contas/CreditCard3D.tsx`: indicação visual de cartão vinculado
- `src/hooks/useAccounts.ts`: propagar `parent_card_id` no CRUD
- `src/pages/Contas.tsx`: agrupamento visual na listagem

