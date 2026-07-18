## Objetivo

Permitir criar um novo cartão de crédito diretamente do modal de Importação de Extrato, sem sair do fluxo, quando o cartão do extrato ainda não existir na conta do usuário. Inclui aviso ao usuário, seleção de contexto (Pessoal / Empresa) e reaproveitamento do modal atual de cartão.

## Mudanças

### 1. `src/components/lancamentos/ImportStatementModal.tsx`

- No seletor de "Cartão *" (linha ~1199), adicionar um botão "+ Criar novo cartão" ao final do `SelectContent` (ou ao lado do `SelectTrigger`).
- Quando os últimos 4 dígitos forem detectados no extrato (`detected_card_digits` presente nas linhas) mas **nenhum** cartão bater (`detectedCards.length === 0` e existe algum `detected_card_digits`), exibir um alerta amarelo acima do seletor:
  > "Não encontramos um cartão terminando em **1234** nas suas contas. Deseja criar?" + botão "Criar cartão".
- Adicionar prop opcional `onCreditCardCreated?: (card) => void` e um callback `refreshCreditCards` recebido do pai (`Lancamentos.tsx`) para recarregar a lista após criação.
- Ao clicar em "Criar cartão", abrir um `CreditCardFormModal` **aninhado** (nested `Dialog`) com:
  - `last_four_digits` pré-preenchido com os dígitos detectados.
  - `name` sugerido (ex.: "Cartão ****1234").
  - Contexto: adicionar um `Select` de "Contexto" (Pessoal / lista de empresas) dentro do próprio `CreditCardFormModal` OU passar via prop `defaultCompanyId`, usando o `useCompany()` atual como default. Ver seção técnica.
- Após salvar, atualizar `creditCards` (via refresh do pai), setar `targetCard = novoId` e fechar apenas o modal aninhado — o modal de importação permanece aberto com o extrato preservado.

### 2. `src/components/contas/CreditCardFormModal.tsx`

- Aceitar props opcionais: `defaultValues?: Partial<CreditCardForm>` (nome, dígitos, banco) e `showContextSelector?: boolean`.
- Quando `showContextSelector` for true, renderizar um `Select` de contexto (Pessoal / empresas do usuário) no topo do formulário e passar `company_id` no payload do `onSave`.
- Nenhuma quebra: props novas são opcionais; comportamento atual em `/contas` fica idêntico.

### 3. `src/pages/Lancamentos.tsx`

- Passar `refreshCreditCards` (a mesma função que já recarrega `creditCards` do hook) para `ImportStatementModal`.

### 4. `src/pages/Contas.tsx` (`handleSaveCreditCard`)

- Verificar se já aceita `company_id` no payload. Se não, estender para propagar `company_id` opcional na inserção em `credit_cards`. (Já existe `company_id` na tabela `credit_cards` — sem migração.)

## Detalhes técnicos

- **Nested Dialog**: Radix suporta modais aninhados; o `CreditCardFormModal` já usa `Dialog`. Basta renderizá-lo dentro do `ImportStatementModal` com estado próprio (`createCardOpen`). O `onPointerDownOutside={preventDefault}` já existente evita fechamento acidental.
- **Refresh**: expor no `Lancamentos.tsx` uma função `reloadCreditCards` a partir do hook (`useAccounts` ou equivalente) e passar como prop. Após o save, chamar e depois `setTargetCard(novoId)`.
- **Contexto**: reaproveitar o `useCompany()` para listar empresas + Pessoal. O `company_id` selecionado é gravado direto em `credit_cards.company_id`. Se o usuário estiver em contexto "Pessoal", default = `null`; se em empresa, default = `selectedCompanyId`.
- **Sem alteração** em: `parse-bank-statement`, `useImportMatching`, matching engine, RLS/policies, schema.

## Fora de escopo

- Detecção automática do banco emissor do cartão a partir do PDF (mantemos o campo "Conta bancária vinculada" como no modal atual).
- Criação em lote de múltiplos cartões (fluxo multi-card continua usando `matched_card_id` já existentes).
