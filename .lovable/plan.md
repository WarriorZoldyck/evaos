

## Fase 3: Gestao de Lancamentos - CRUD Completo

### Situacao atual

A pagina `/lancamentos` e apenas um placeholder. O banco ja possui **682 transacoes** reais (236 receitas pagas, 346 despesas pagas, 100 pendentes), **47 parcelados**, **43 recorrentes**, **10 contas bancarias**, **9 cartoes de credito**, **4 carteiras**, **31 fornecedores**, **5 clientes** e **362 categorias**. Todos esses dados serao preservados e utilizados nos formularios.

### O que sera construido

---

#### 1. Pagina Principal de Lancamentos (`src/pages/Lancamentos.tsx`)

**Header com acoes**
- Titulo "Lancamentos" + subtitulo com contexto (Pessoal/Empresa)
- Botao "+ Novo Lancamento" (destaque em azul) que abre o modal de criacao
- Barra de busca por descricao
- Filtros rapidos: Tipo (Receita/Despesa/Todos), Status (Pago/Pendente/Todos), Categoria

**Abas de visualizacao**
- Aba "Realizado" - transacoes com status "Pago"
- Aba "Projetado" - transacoes com status "Pendente"
- Aba "Todos" - todas as transacoes

**Lista/tabela de transacoes**
- Colunas: Data Pagamento, Descricao, Categoria, Contato, Valor (verde para receita, vermelho para despesa), Status (badge), Acoes
- Paginacao (20 itens por pagina)
- Indicador visual para parcelados (ex: "3/12")
- Ordenacao por data (mais recentes primeiro)
- Cada linha tera botoes: Editar, Duplicar, Excluir, e Liquidar (se pendente)

---

#### 2. Modal de Novo Lancamento (`src/components/lancamentos/TransactionFormModal.tsx`)

**Tabs no topo do modal: Receita | Despesa | Transferencia**

**Campos do formulario (Receita e Despesa):**
- Descricao (texto, obrigatorio)
- Valor (R$, numerico, obrigatorio)
- Data de Pagamento (date picker, obrigatorio)
- Data de Competencia (date picker, obrigatorio, default = data pagamento)
- Status: Pendente / Pago (select)
- Categoria (select populado da tabela `categories`, filtrado pelo contexto)
- Subcategoria (select, aparece apos selecionar categoria pai)
- Sub-subcategoria (select, aparece apos selecionar subcategoria, 3o nivel)
- Forma de Pagamento: PIX, Boleto, Dinheiro, Cartao de Credito, Cartao de Debito, Transferencia
- Conta Bancaria OU Cartao de Credito OU Carteira (condicional conforme forma de pagamento)
- Fornecedor (para despesa) ou Cliente (para receita) - select com busca
- Nome do contato (campo texto alternativo se nao quiser usar o select)
- Observacoes (textarea, opcional)
- Codigo de barras (texto, opcional)
- Anexo (URL, opcional)

**Opcao de parcelamento:**
- Toggle "Parcelado?"
- Se sim: Numero de parcelas (inteiro)
- Gera N transacoes com `series_id` compartilhado, `installment_number` sequencial, valor dividido

**Campos do formulario (Transferencia):**
- Valor
- Data
- Conta de Origem (select)
- Conta de Destino (select)
- Descricao
- Cria 2 transacoes vinculadas por `transfer_id`: uma despesa na origem, uma receita no destino

---

#### 3. Edicao e Exclusao de Lancamentos

**Editar**: Abre o mesmo modal preenchido com os dados existentes. Ao salvar, atualiza via `supabase.update()`.

**Excluir transacao simples**: Confirmacao via dialog, depois `supabase.delete()`.

**Excluir/Editar parcelados (series_id):** Dialog com 3 opcoes:
- "Apenas este" - edita/exclui so o selecionado
- "Este e os proximos" - edita/exclui do selecionado em diante (filtra por `series_id` + `installment_number >= atual`)
- "Todos da serie" - edita/exclui todos com o mesmo `series_id`

**Liquidar**: Reutiliza o `LiquidateModal` existente do Dashboard

---

#### 4. Hook de dados (`src/hooks/useTransactions.ts`)

- Busca transacoes filtradas por contexto (Pessoal/Empresa), tipo, status, busca textual, categoria
- Suporta paginacao server-side
- Funcoes: `createTransaction`, `updateTransaction`, `deleteTransaction`, `deleteSeriesTransactions`
- Busca de dados auxiliares: contas bancarias, cartoes, carteiras, categorias, fornecedores, clientes

---

### Arquivos que serao criados/modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Lancamentos.tsx` | Reescrever: pagina completa com listagem, busca, filtros e abas |
| `src/hooks/useTransactions.ts` | Criar: hook para CRUD de transacoes + dados auxiliares |
| `src/components/lancamentos/TransactionFormModal.tsx` | Criar: modal com formulario completo (tabs Receita/Despesa/Transferencia) |
| `src/components/lancamentos/TransactionTable.tsx` | Criar: tabela de transacoes com acoes |
| `src/components/lancamentos/TransactionFilters.tsx` | Criar: barra de filtros e busca |
| `src/components/lancamentos/SeriesEditDialog.tsx` | Criar: dialog para edicao/exclusao de parcelados |

### Detalhes tecnicos

**Formulario**
- React Hook Form + Zod para validacao
- Campos condicionais (ex: conta bancaria so aparece se forma de pagamento for PIX/Boleto/Transferencia; cartao aparece se for Cartao de Credito)
- Categorias carregadas em cascata: nivel 1 (parent_id = null) > nivel 2 (parent_id = cat1) > nivel 3 (parent_id = cat2)
- Fornecedores/clientes carregados via select com busca (combobox)

**Parcelamento**
- Ao criar parcelado, gera um `series_id` (UUID), calcula valor por parcela (valor total / N), cria N registros com `installment_number` de 1 a N, datas de pagamento incrementais (mensal)

**Transferencia**
- Gera um `transfer_id` (UUID), cria transacao de despesa na conta origem e receita na conta destino, ambas com o mesmo `transfer_id`

**Contexto**
- Todas as queries filtram por `company_id` (empresa selecionada) ou `company_id IS NULL` (pessoal)
- `user_id` e sempre preenchido com `auth.uid()` (RLS garante seguranca)

**Preservacao de dados**
- Nenhuma migracao de banco necessaria - a estrutura ja esta completa
- Nenhum dado existente sera alterado ou excluido
- Todas as 682 transacoes, 43 recorrentes e demais registros permanecem intactos
