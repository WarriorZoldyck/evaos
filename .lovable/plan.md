

## Plano de Implementacao dos 4 Itens Pendentes

### Visao Geral

Existem 4 funcionalidades pendentes a serem implementadas em fases independentes, minimizando o risco de quebrar o app. Cada fase modifica arquivos isolados ou adiciona novos componentes.

---

### Fase 1: Filtro por Fornecedor e Cliente nos Lancamentos

**Objetivo**: Adicionar dois selects de filtro na barra de filtros de lancamentos.

**Arquivos modificados**:
- `src/hooks/useTransactions.ts` -- adicionar `supplierId` e `clientId` ao tipo `TransactionFilters` e aplicar os filtros na query Supabase
- `src/components/lancamentos/TransactionFilters.tsx` -- adicionar dois `<Select>` (Fornecedor e Cliente) que recebem as listas ja disponiveis via props
- `src/pages/Lancamentos.tsx` -- passar `suppliers` e `clients` como props para o componente `TransactionFilters`

**Detalhes tecnicos**:
- Adicionar `supplierId: string` e `clientId: string` ao `TransactionFilters` (inicializados como `""`)
- No `fetchTransactions`, aplicar `.eq("supplier_id", ...)` e `.eq("client_id", ...)` quando preenchidos
- No componente de filtros, renderizar os selects condicionalmente (quando ha fornecedores/clientes cadastrados)
- Suportar query params `supplierId` e `clientId` para drill-down vindo do dashboard

---

### Fase 2: Extrato / Movimentacao por Conta, Carteira e Cartao

**Objetivo**: Criar uma visualizacao de extrato dentro da pagina `/contas`, mostrando transacoes filtradas por conta selecionada, com saldo progressivo.

**Arquivos criados**:
- `src/components/contas/AccountStatementModal.tsx` -- modal com listagem de transacoes filtradas pela conta, exibindo saldo corrente acumulado

**Arquivos modificados**:
- `src/pages/Contas.tsx` -- adicionar um botao "Extrato" em cada linha de conta bancaria, carteira e cartao, que abre o modal de extrato

**Detalhes tecnicos**:
- O modal recebe o `accountId` e o `accountType` ("bank" | "wallet" | "card")
- Internamente, faz query em `transactions` filtrando pelo campo correto (`bank_account_id`, `wallet_id` ou `credit_card_id`)
- Exibe uma lista cronologica com:
  - Data | Descricao | Entrada | Saida | Saldo Acumulado
- O saldo inicial vem de `bank_accounts.initial_balance` ou `wallets.initial_balance` (para cartoes, nao ha saldo inicial -- mostra apenas movimentacao)
- Inclui filtro de periodo (mes/ano) simples
- Nao altera nenhuma tabela do banco de dados -- usa dados existentes

---

### Fase 3: Upload de Extrato Bancario (PDF/OFX)

**Objetivo**: Permitir que o usuario faca upload de um extrato bancario (CSV, OFX ou PDF) para gerar rascunhos de transacoes automaticamente.

**Arquivos criados**:
- `supabase/functions/parse-bank-statement/index.ts` -- Edge Function que recebe o arquivo, faz parsing e retorna transacoes extraidas
- `src/components/lancamentos/ImportStatementModal.tsx` -- Modal com upload de arquivo, preview das transacoes extraidas e botao para confirmar importacao

**Arquivos modificados**:
- `src/pages/Lancamentos.tsx` -- adicionar botao "Importar Extrato" ao lado do "Novo Lancamento"

**Detalhes tecnicos**:
- **OFX**: A Edge Function faz parsing textual (OFX e um formato baseado em SGML, pode ser lido com regex ou parser leve)
- **CSV**: Parsing basico com deteccao de colunas (data, descricao, valor)
- **PDF**: Extrai texto e tenta identificar linhas de transacao com regex (abordagem best-effort -- funciona bem para extratos padrao)
- O modal mostra preview das transacoes detectadas em uma tabela editavel
- O usuario pode selecionar/deselecionar, editar categorias e contas antes de confirmar
- Ao confirmar, usa `createMultipleTransactions` ja existente
- Criar um bucket de storage `bank-statements` para armazenar os arquivos originais (opcional, pode ser descartado apos processamento)

**Migracao de banco**: Nenhuma alteracao no schema. As transacoes importadas usam o campo `external_id` ja existente para evitar duplicatas.

---

### Fase 4: Assistente de Agenda

**Objetivo**: Criar uma tela simples de agenda financeira que mostra compromissos financeiros futuros organizados por dia/semana.

**Arquivos criados**:
- `src/pages/Agenda.tsx` -- pagina com visualizacao de calendario mostrando transacoes pendentes por dia
- `src/components/agenda/AgendaCalendarView.tsx` -- componente de visualizacao tipo agenda/calendario

**Arquivos modificados**:
- `src/App.tsx` -- adicionar rota `/agenda`
- `src/components/layout/AppSidebar.tsx` -- adicionar item "Agenda" no menu principal

**Detalhes tecnicos**:
- Consulta transacoes com `status = 'Pendente'` e `payment_date >= hoje`
- Tambem consulta `recurring_transactions` para mostrar recorrencias futuras
- Visualizacao em formato de lista por dia (semelhante a uma agenda), com:
  - Agrupamento por data
  - Icone de tipo (entrada/saida)
  - Valor e descricao
  - Botao rapido para liquidar
- Inclui filtro de periodo (proximos 7, 15, 30, 60 dias)
- Nao altera banco de dados -- leitura pura

---

### Ordem de Implementacao Recomendada

1. **Fase 1** (Filtros) -- Menor risco, modifica apenas filtros existentes
2. **Fase 2** (Extrato) -- Adiciona funcionalidade nova sem alterar existente
3. **Fase 4** (Agenda) -- Pagina nova independente
4. **Fase 3** (Import) -- Mais complexa, requer Edge Function

### Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Quebrar filtros existentes ao adicionar novos campos | Valores iniciais `""` garantem que filtros nao afetam queries quando vazios |
| Extrato com muitas transacoes | Paginacao e filtro de periodo no modal |
| Parsing de PDF impreciso | Marcar como "beta", permitir edicao manual antes de confirmar importacao |
| Impacto no bundle size | Componentes novos sao lazy-loadable via React.lazy se necessario |

