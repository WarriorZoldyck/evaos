

## Transferencia Entre Contas (Pessoal e Empresa)

### Problema Atual

O formulario de transferencia so mostra contas do contexto atual (Pessoal ou Empresa selecionada). Porem, transferencias sao justamente para mover dinheiro **entre** contextos diferentes -- de uma conta pessoal para uma conta da empresa, ou vice-versa.

### Solucao

Buscar **todas** as contas do usuario (de todos os contextos) especificamente para o formulario de transferencia, e exibi-las agrupadas por contexto (Pessoal / Nome da Empresa).

---

### Mudancas

**Arquivo: `src/hooks/useTransactions.ts`**

- Adicionar um novo estado `allAccounts` que busca contas bancarias, carteiras e cartoes de credito **sem** o `companyFilter`
- Buscar tambem os nomes das empresas do usuario para usar como labels nos grupos
- Retornar `allAccounts` no return do hook

Estrutura do novo estado:
```text
allAccounts: {
  bankAccounts: { id, name, company_id, company_name }[]
  wallets: { id, name, company_id, company_name }[]
  creditCards: { id, name, last_four_digits, company_id, company_name }[]
}
```

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**

- Receber `allAccounts` como prop
- No formulario de transferencia, usar `allAccounts` em vez de `bankAccounts`/`wallets`/`creditCards`
- Agrupar as opcoes nos selects por contexto:
  - "Pessoal" para contas com `company_id = null`
  - Nome da empresa para contas vinculadas a uma empresa
- Ao submeter a transferencia, determinar o `company_id` correto para cada lancamento baseado na conta selecionada (origem e destino podem ter `company_id` diferentes)

**Arquivo: `src/pages/Lancamentos.tsx`**

- Passar `allAccounts` como prop para `TransactionFormModal`

### Logica da Transferencia ao Salvar

Quando o usuario transfere de uma conta pessoal para uma conta da empresa:
- Lancamento de **saida** (despesa): `company_id = null` (pessoal)
- Lancamento de **entrada** (receita): `company_id = id_da_empresa`

Cada lancamento herda o `company_id` da conta que foi selecionada como origem/destino, respectivamente.

### Tab Label

Renomear a aba de "Transferencia" para "Transferencia entre Contas" para deixar claro o proposito.
