

## EVA - Dashboard de Gestão Financeira Inteligente

### Fase 1: Fundação (Auth + Layout + Navegação)

**Página de Login/Cadastro**
- Tela de autenticação com tema escuro (azul marinho profundo)
- Campos de email e senha com validação
- Links para "Esqueci minha senha" e "Cadastre-se"
- Redirecionamento automático após login

**Layout Principal com Sidebar**
- Sidebar colapsável com ícones Lucide React
- Menu: Dashboard, Lançamentos, Plano de Caixa, DRE, Precificação, Contas & Cartões, Categorias, Fornecedores/Clientes, Configurações
- Seletor de contexto global no topo: "Pessoal" ou "Empresa X" (usando tabela `companies`)
- Tema escuro como padrão (slate/gray 900, tons de azul marinho)
- Layout responsivo com suporte mobile

---

### Fase 2: Dashboard Inteligente

**Cards de Resumo**
- Faturamento, Entradas, Saídas e Saldo do Período
- Valores calculados dinamicamente a partir da tabela `transactions` filtrados pelo contexto (Pessoal/Empresa)

**Filtros**
- Filtro de período: Hoje, Esta Semana, Este Mês, Este Ano, Personalizado (calendário)
- Todos os dados reagem ao contexto global e ao período selecionado

**Gráficos (Recharts)**
- Gráfico de linha para "Projeção de Saldo" com filtros de 30, 60 e 90 dias
- Dois gráficos de rosca (doughnut) para "Resumo do Mês por Categoria" — um para Receitas e outro para Despesas

**Listas de Ação**
- "Próximos Lançamentos" pendentes com botão "Liquidar"
- Modal de liquidação: confirmar valor final, data e conta de saída
- Card de "Análise de Performance" com gasto médio diário

---

### Fase 3: Gestão de Lançamentos

**Lista de Transações**
- Visualização em lista agrupada por origem (Carteira, Banco, Cartão)
- Abas para "Realizado" e "Projetado"
- Busca por descrição e filtros por categoria, status e tipo

**Modal de Registro (CRUD Completo)**
- Tabs para Receita / Despesa / Transferência
- Campos: contexto, tipo, status, valor, data de pagamento, data de competência, categoria/subcategoria (3 níveis), fornecedor/cliente, conta bancária, cartão ou carteira
- Suporte a lançamentos parcelados (series_id, installment_number)
- Suporte a lançamentos recorrentes (tabela recurring_transactions)

**Lógica de Transferência**
- Um comando cria duas transações vinculadas por transfer_id (saída de uma conta, entrada em outra)

**Edição em Série**
- Ao editar/excluir parcelados: opções "Apenas este", "Este e os próximos", "Todos da série"

---

### Fase 4: Módulos Financeiros

**Plano de Caixa (Fluxo de Caixa)**
- Visão por regime de caixa (data de pagamento)
- Agrupamento por período e categoria

**DRE por Competência**
- Visão por regime de competência (competence_date)
- Agrupado por categorias hierárquicas

**Precificação (FHC)**
- Calculadora baseada em custos fixos, variáveis, tempo de execução e margem de lucro
- Utiliza as tabelas pricing_configurations e pricing_procedures existentes

---

### Fase 5: Cadastros e CRM

**Contas & Cartões**
- CRUD para contas bancárias (com agência e número)
- CRUD para cartões de crédito (com limite, dia de fechamento e vencimento)
- CRUD para carteiras digitais
- Saldo calculado dinamicamente a partir das transações pagas

**Gestão de Categorias**
- Interface em árvore hierárquica com 3 níveis: Categoria > Subcategoria > Sub-subcategoria
- Separação entre "Canais de Receita" e "Centros de Despesa"

**Clientes e Fornecedores**
- Tabelas com nome e CNPJ/CPF
- Adicionar, editar e excluir registros

**Gestão de Empresas**
- CRUD de empresas com nome e CNPJ
- As empresas aparecem no seletor de contexto global

---

### Fase 6: Importação Inteligente

**Upload de Extratos**
- Botão para upload de arquivos CSV e PDF
- Edge function para processar os arquivos
- Extratos são transformados em rascunhos de transações para revisão antes de salvar
- Interface para revisar, ajustar categorias e confirmar importação em lote

---

### Design e UX

- **Tema**: Dark mode predominante com azul marinho profundo (#0f172a, #1e293b) e acentos em azul (#3b82f6)
- **Tipografia**: Inter (clean e profissional)
- **Ícones**: Lucide React em todo o app
- **Notificações**: Sistema de toast para feedback de sucesso/erro
- **Responsividade**: Layout adaptável para desktop e mobile

