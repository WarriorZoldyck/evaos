## Problema

No **Análises EVA**, ao abrir um lançamento pendente para editar e trocar o **contexto** (Pessoal ↔ Empresa) dentro do modal, as listas de **Conta bancária / Carteira / Cartão / Maquininha** não são reabastecidas com as contas do novo contexto — elas continuam mostrando (ou vazias) apenas o que estava no contexto global ativo.

## Causa

O `TransactionFormModal` filtra contas dinamicamente pelo `formCompanyId` (o contexto escolhido dentro do modal) **apenas quando recebe as props `allAccounts` e `allCardTerminals`** (linhas 517–541). Sem elas, cai no fallback `bankAccounts` / `wallets` / `creditCards` / `cardTerminals`, que já vêm pré-filtrados pelo contexto global.

- Em `GlobalTransactionModal.tsx` essas props são passadas (via `useTransactions`) → funciona.
- Em `src/pages/AnalisesEva.tsx` (linhas ~1131–1148) **não são passadas**, e as listas (`accounts`, `wallets`, `creditCards`, `cardTerminals`) vêm de `useAccounts()`, que filtra por `selectedCompanyId`/`isPersonal` global.

Resultado: ao trocar o contexto no modal, as contas do outro contexto simplesmente não existem no array → o campo fica vazio / não puxa a conta certa.

## Plano

Editar apenas `src/pages/AnalisesEva.tsx`:

1. Trocar o consumo de `useAccounts()` por `useTransactions()` (mesmo hook usado pelo `GlobalTransactionModal`) para obter também `allAccounts` e `allCardTerminals` (listas cross-contexto).
   - Alternativa mais cirúrgica, se preferirmos não puxar `useTransactions` inteiro: fazer duas queries diretas ao Supabase (`bank_accounts`, `wallets`, `credit_cards`, `card_terminals`) sem o filtro de contexto e montar os arrays `allAccounts` / `allCardTerminals` localmente. Vou usar a versão via `useTransactions` para reaproveitar o pattern existente.
2. Passar as novas props ao `TransactionFormModal`:
   ```tsx
   allAccounts={allAccounts}
   allCardTerminals={allCardTerminals}
   ```
3. Manter `bankAccounts`, `wallets`, `creditCards`, `cardTerminals` como estão (fallback / listagem visual da página fora do modal continua no contexto atual).

## Fora de escopo

- Sem mudanças no `TransactionFormModal`, no schema, ou na lógica de salvar (`handlePendingUpdate`).
- Sem alteração no comportamento da listagem principal de Análises EVA (continua respeitando o contexto global).
