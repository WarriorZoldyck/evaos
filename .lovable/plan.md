

## Precificacao V2 - FHC Completo com Custo de Vida

Transformar a pagina placeholder "Precificacao V2" em um modulo completo, baseado na planilha FHC que inclui **custo de vida pessoal** integrado ao calculo. A diferenca principal do V1 e que aqui o usuario cadastra **todos** os custos manualmente (nao puxa do banco de transacoes), e o calculo inclui impostos (NF) e metricas de lucratividade.

---

### Estrutura da Planilha (resumo)

A planilha organiza os custos em 3 grandes grupos:

```text
+---------------------------+-----------------------------+---------------------------+
| Despesas Fixas Clinica    | Despesas Variaveis Clinica  | Despesas Casa (Pessoais)  |
+---------------------------+-----------------------------+---------------------------+
| Prediais                  | Dentais                     | Educacao                  |
| Salarios                  | Salario (parceiros)         | Moradia                   |
| Administrativos           | Laboratorio                 | Salarios (baba etc)       |
| Outros                    | Honorarios                  | Lazer                     |
|                           | Implantes                   | Planejamento              |
|                           | Administrativo              | Vestuario                 |
|                           | Diversos                    | Superfluos                |
|                           |                             | Alimentacao               |
|                           |                             | Transporte                |
|                           |                             | Saude                     |
|                           |                             | Outros                    |
+---------------------------+-----------------------------+---------------------------+
```

Cada item tem: descricao, valor e frequencia (Mensal ou Anual). Itens anuais sao divididos por 12 para o calculo mensal.

O calculo final do procedimento:
- **CF** (custo fixo) = Custo/Hora x Tempo
- **CV** (custo variavel) = soma dos materiais
- **NF** (imposto) = Valor cobrado x Aliquota IR
- **Lucro** = Valor cobrado - CF - CV - NF
- **Lucratividade/h** = Lucro / Tempo
- **Lucratividade %** = Lucro / Valor cobrado

Inclui tambem: **Quantidade de Salas** e calculo de **FMM/sala** (Faturamento Minimo Mensal por sala).

---

### Plano de Implementacao

#### 1. Novas tabelas no Supabase

**`pricing_v2_configurations`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid | FK auth.users |
| hours_per_month | integer | Horas trabalhadas/mes (default 160) |
| num_rooms | integer | Quantidade de salas (default 1) |
| tax_rate | numeric | Aliquota IR em % (default 8.44) |
| updated_at | timestamptz | |

**`pricing_v2_cost_items`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| config_id | uuid | FK pricing_v2_configurations |
| user_id | uuid | Para RLS |
| group | text | "fixos_clinica", "variaveis_clinica" ou "pessoais" |
| category | text | Ex: "Prediais", "Educacao" |
| description | text | Ex: "Aluguel", "Escola Anna" |
| value | numeric | Valor em R$ |
| frequency | text | "M" (mensal) ou "A" (anual) |

**`pricing_v2_procedures`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| user_id | uuid | |
| name | text | Nome do procedimento |
| execution_time | numeric | Tempo em horas |
| desired_price | numeric | Valor cobrado |
| created_at | timestamptz | |

**`pricing_v2_procedure_items`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| procedure_id | uuid | FK pricing_v2_procedures |
| description | text | Material/insumo |
| value | numeric | Custo unitario |

RLS em todas: `auth.uid() = user_id` (ou via join para items).

#### 2. Hook `usePricingV2`

Similar ao `usePricing`, mas:
- Busca `pricing_v2_configurations` + `pricing_v2_cost_items`
- Calcula custos mensais somando itens (A dividido por 12, M direto)
- Agrupa por `group` para mostrar totais por grupo
- Calcula Custo/Hora = (Total Fixos Clinica + Total Var Clinica + Total Pessoais) / horas_per_month
- Calcula FMM = Total de todos custos mensais
- Calcula FMM/sala = FMM / num_rooms
- Calcula CF/H/sala = Custo/Hora / num_rooms
- Procedimentos: Lucro = desired_price - CF - CV - (desired_price x tax_rate/100)

#### 3. Pagina `PrecificacaoV2.tsx`

Layout em 4 secoes (abas ou scroll):

**Secao 1 - Configuracao Geral**
- Horas/mes, Quantidade de salas, Aliquota IR (%)
- Botao Salvar

**Secao 2 - Despesas (3 grupos em Tabs)**
- Tab "Fixos Clinica" | Tab "Variaveis Clinica" | Tab "Pessoais"
- Cada tab: tabela editavel com Categoria, Descricao, Valor, Frequencia (M/A)
- Botao "+ Adicionar item" por tab
- Subtotal por categoria e total do grupo

**Secao 3 - Resumo de Custos**
- Cards com: Total Fixos Clinica, Total Var Clinica, Total Pessoais
- Cards destaque: Custo/Hora, FMM, FMM/sala, CF/H/sala
- Grafico de pizza com % de cada grupo/categoria

**Secao 4 - Procedimentos**
- Mesma tabela do V1 mas com colunas extras: CF, CV, NF, Lucro, Lucratividade/h, Lucratividade %
- Modal de criacao/edicao similar ao V1
- Decomposicao com imposto incluso

#### 4. Componentes novos

| Componente | Descricao |
|------------|-----------|
| `src/pages/PrecificacaoV2.tsx` | Pagina principal substituindo o placeholder |
| `src/hooks/usePricingV2.ts` | Hook de dados e logica |
| `src/components/precificacao-v2/CostItemsTab.tsx` | Tabela editavel de itens de custo por grupo |
| `src/components/precificacao-v2/ConfigCard.tsx` | Card de configuracao (horas, salas, aliquota) |
| `src/components/precificacao-v2/CostSummaryCards.tsx` | Cards resumo + grafico |
| `src/components/precificacao-v2/ProcedureTableV2.tsx` | Tabela de procedimentos com metricas extras |
| `src/components/precificacao-v2/ProcedureFormModalV2.tsx` | Modal criar/editar procedimento |
| `src/components/precificacao-v2/ProcedureBreakdownV2.tsx` | Decomposicao detalhada |

#### 5. Atualizacao do roteamento

- Em `App.tsx`: substituir o `<ComingSoon>` da rota `/precificacao-v2` pelo novo componente `<PrecificacaoV2 />`

#### 6. Migracao SQL

Uma unica migracao criando as 4 tabelas com RLS habilitado e politicas de acesso por `user_id`.

---

### Diferenca V1 vs V2

| Aspecto | V1 | V2 |
|---------|----|----|
| Fonte de custos | Transacoes reais (12 meses) | Cadastro manual pelo usuario |
| Grupos de custo | 2 (Fixos Clinica + Pessoais) | 3 (Fixos + Variaveis Clinica + Pessoais) |
| Impostos | Nao considera | Aliquota IR aplicada no preco |
| Salas | Nao tem | Calculo por sala |
| Metricas | Preco sugerido | Lucro, Lucratividade/h, Lucratividade % |
| Frequencia | Nao aplica (media automatica) | Mensal ou Anual por item |

