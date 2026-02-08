

## Fase 4 - Modulo de Precificacao (FHC - Formacao de Hora Clinica)

### O que e o FHC

A Formacao de Hora Clinica (FHC) e um metodo de precificacao que calcula o preco minimo de cada procedimento com base em:
1. **Custos fixos totais** (clinica + pessoais) divididos pelas horas trabalhadas no mes = **custo por hora**
2. **Custos variaveis** do procedimento (materiais, laboratorio, etc.)
3. **Tempo de execucao** do procedimento
4. **Margem de lucro** desejada

**Formula:**
```text
Custo/Hora = (Despesas Fixas Clinica + Despesas Casa) / Horas Trabalhadas por Mes

Preco Procedimento = (Custo/Hora x Tempo de Execucao em horas) + Custos Variaveis + Margem de Lucro
```

### Estrutura de custos (baseada na planilha enviada)

A planilha define 3 grupos de despesa, que serao usados para calcular automaticamente o custo/hora a partir das transacoes reais do banco de dados:

- **Despesas Fixas Clinica**: Prediais, Salarios, Administrativos, Outros
- **Despesas Variaveis Clinica**: Dentais, Salario, Laboratorio, Honorarios, Implantes, Administrativo, Diversos
- **Despesas Casa/Pessoais**: Educacao, Moradia, Salarios, Lazer, Planejamento, Vestuario, Alimentacao, Transporte, Saude, Outros

### O que sera construido

---

#### 1. Pagina de Precificacao (`src/pages/Precificacao.tsx`)

**Secao 1 - Configuracao Geral (Card superior)**
- Horas trabalhadas por mes (input numerico, default 160)
- Margem de lucro padrao (input %, default 30%)
- Botao "Salvar Configuracao"
- Card resumo mostrando:
  - Total Despesas Fixas Clinica (calculado das transacoes)
  - Total Despesas Pessoais (calculado das transacoes)
  - **Custo por Hora Clinica** (destaque visual)

**Secao 2 - Lista de Procedimentos (Cards/Tabela)**
- Botao "+ Novo Procedimento"
- Tabela com colunas: Nome, Tempo (horas), Custos Variaveis, Custo Total, Preco Sugerido, Preco Desejado, Acoes
- Cada procedimento mostra o calculo detalhado em tooltip/expansao
- Botoes: Editar, Duplicar, Excluir

**Secao 3 - Card de Calculo Detalhado (ao selecionar procedimento)**
- Decomposicao do preco: custo fixo proporcional + materiais + margem
- Comparacao: Preco Sugerido vs Preco Desejado
- Indicador visual se o preco desejado esta abaixo do custo

---

#### 2. Modal de Procedimento (`src/components/precificacao/ProcedureFormModal.tsx`)

**Campos:**
- Nome do procedimento (texto, obrigatorio)
- Tempo de execucao em horas (numerico, obrigatorio, ex: 1.5)
- Preco desejado (R$, opcional - para comparacao)
- Lista de itens de custo variavel (dinamica, adicionar/remover):
  - Descricao do item (ex: "Resina composta", "Anestesia")
  - Valor unitario (R$)

**Calculo em tempo real no modal:**
- Custo fixo proporcional = Custo/Hora x Tempo
- Custos variaveis = soma dos itens
- Subtotal = Custo fixo + Custos variaveis
- Margem = Subtotal x % margem
- **Preco sugerido = Subtotal + Margem**

---

#### 3. Hook de Precificacao (`src/hooks/usePricing.ts`)

**Busca de custos reais (do banco de dados):**
- Soma todas as transacoes do tipo "despesa" com status "Pago" dos ultimos 12 meses
- Separa por categoria para classificar em Fixos Clinica vs Pessoais
- Calcula media mensal de cada grupo

**CRUD de configuracao:**
- Salva/busca `pricing_configurations` (hours_per_month, profit_margin, matrix_values)
- `matrix_values` armazenara o mapeamento de categorias para grupos de custo

**CRUD de procedimentos:**
- Lista, cria, atualiza, exclui `pricing_procedures`
- Lista, cria, atualiza, exclui `pricing_procedure_items` (itens de custo variavel)

---

#### 4. Componentes auxiliares

| Componente | Descricao |
|---|---|
| `PricingConfigCard.tsx` | Card com horas/mes, margem e resumo de custos |
| `ProcedureTable.tsx` | Tabela de procedimentos com calculo inline |
| `ProcedureFormModal.tsx` | Modal para criar/editar procedimento + itens de custo |
| `CostBreakdownCard.tsx` | Card de decomposicao detalhada do preco |

---

### Arquivos que serao criados/modificados

| Arquivo | Acao |
|---|---|
| `src/pages/Precificacao.tsx` | Reescrever: pagina completa com config + lista de procedimentos |
| `src/hooks/usePricing.ts` | Criar: hook para configuracao, custos reais e CRUD de procedimentos |
| `src/components/precificacao/PricingConfigCard.tsx` | Criar: card de configuracao geral e resumo de custos |
| `src/components/precificacao/ProcedureTable.tsx` | Criar: tabela de procedimentos com precos calculados |
| `src/components/precificacao/ProcedureFormModal.tsx` | Criar: modal de procedimento com itens de custo variavel |
| `src/components/precificacao/CostBreakdownCard.tsx` | Criar: decomposicao visual do preco de um procedimento |

### Detalhes tecnicos

**Calculo do Custo/Hora**
- Busca transacoes "despesa" + "Pago" dos ultimos 12 meses
- O campo `matrix_values` (JSONB) na tabela `pricing_configurations` armazena um mapa configuravel: quais categorias pertencem a "Fixos Clinica" e quais a "Pessoais"
- Valores default baseados nas categorias da planilha (Prediais, Salarios, Administrativos, etc.)
- Total mensal = soma dos 12 meses / 12

**Persistencia**
- Configuracao salva em `pricing_configurations` (1 registro por usuario)
- Procedimentos salvos em `pricing_procedures` com `user_id`
- Itens de custo em `pricing_procedure_items` vinculados por `procedure_id`

**Integracao com dados reais**
- O modulo puxa automaticamente os custos reais das transacoes ja cadastradas
- Quanto mais transacoes o usuario registrar, mais preciso sera o FHC
- Se nao houver transacoes, o usuario pode informar valores manualmente no `matrix_values`

**Contexto**
- A precificacao nao filtra por empresa/pessoal pois e um calculo global do profissional
- Usa `user_id` do auth para RLS

**Preservacao de dados**
- Nenhuma migracao de banco necessaria
- As 3 tabelas de pricing ja existem e estao vazias, prontas para uso
- Nenhum dado existente sera alterado

