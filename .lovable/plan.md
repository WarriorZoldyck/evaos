

## Análise: Checklist da Planilha vs App

### O que JÁ ESTÁ no app (sem necessidade de mudança)

| Item | Onde está |
|------|-----------|
| Cadastro separado de despesas Casa vs Negócio | Precificação V1 — 3 abas (Fixos Clínica, Variáveis, Pessoais) |
| Custo de Vida como base do preço | FMM inclui despesas pessoais no cálculo |
| Subcategorias detalhadas (Educação, Moradia, etc.) | CostItemsTab com categorias iguais à planilha |
| Método de pagamento nas transações | TransactionFormModal (PIX, boleto, cartão, etc.) |
| Custo/Hora, FMM, FMM/Sala, CF/H/Sala | CostSummaryCards |
| Lucratividade por procedimento (Lucro, Lucr./h, %) | ProcedureBreakdownV2 e ProcedureTableV2 |
| Líquido (Preço − NF), Total Ano | Já implementados na rodada anterior |
| Distribuição % por subcategoria | Barra de breakdown no CostItemsTab |
| Faturamento Mínimo Anual | Card dedicado no CostSummaryCards |

### O que FALTA (itens para implementar na Precificação)

**1. Cálculo detalhado de horas (Dias × Horas/dia)**
A planilha calcula horas/mês a partir de "dias trabalhados por semana × horas por dia × semanas no mês". O app tem apenas um campo inteiro "Horas/mês". Implementar campos adicionais opcionais:
- Dias trabalhados / semana
- Horas / dia
- O campo "Horas/mês" é preenchido automaticamente (dias × horas × 4.33)
- O usuário pode ainda editar manualmente se quiser

**2. Dashboard: Lucro Real após despesas pessoais**
O Dashboard mostra receita − despesa, mas NÃO isola "lucro após custo de vida". Este item NÃO pertence à precificação — pertence ao Dashboard. Porém, o Dashboard já mostra o resultado líquido (receitas - despesas). Se as despesas pessoais estão registradas como transações, o resultado já reflete isso. **Nenhuma mudança necessária** — o dado já está lá implicitamente.

**3. Previsto vs Consolidado**
A planilha compara valores planejados vs realizados. Isso é uma funcionalidade de **orçamento/budget**, que não existe no app em nenhum lugar. Isso é um módulo novo, não pertence à precificação.

### Plano de implementação

Apenas o item 1 precisa ser implementado na Precificação. Os outros itens ou já existem ou pertencem a módulos diferentes (Dashboard, Orçamento).

**Alterações no `ConfigCard.tsx`:**
- Adicionar campos opcionais "Dias/semana" e "Horas/dia" acima do campo "Horas/mês"
- Quando preenchidos, calcular automaticamente: `dias × horas × 4.33` e preencher o campo Horas/mês
- Manter o campo Horas/mês editável como override manual
- Persistir dias/semana e horas/dia no banco (nova coluna ou usar o JSON existente)

**Migração de banco:**
- Adicionar colunas `days_per_week` (numeric, nullable) e `hours_per_day` (numeric, nullable) na tabela `pricing_v2_configurations`

**Alterações no `usePricingV2.ts`:**
- Incluir `days_per_week` e `hours_per_day` no fetch/save do config
- Calcular horas automáticas quando ambos campos estão preenchidos

### Detalhes técnicos
- Fórmula: `hoursPerMonth = daysPerWeek × hoursPerDay × 4.33` (4.33 = média de semanas/mês)
- Os campos são opcionais — se vazios, o campo horas/mês funciona como antes
- Sem impacto em nenhum outro módulo

