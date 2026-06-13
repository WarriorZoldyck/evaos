## Objetivo

Tornar a DRE Contábil do EVA totalmente aderente ao padrão contábil brasileiro, com a estrutura escalonada completa e análises vertical (AV%) e horizontal (AH%) na mesma tabela.

## Estrutura final da DRE (resultado esperado na tela)

```text
(+) Receita Operacional Bruta
(−) Deduções e Impostos sobre Venda
(=) Receita Líquida
(−) CMV / CSP
(=) Lucro Bruto
(−) Despesas com Vendas
(−) Despesas Operacionais e Administrativas
(−) Despesas Gerais e Administrativas
(=) EBITDA                          ← NOVO subtotal
(−) Depreciação e Amortização       ← NOVA seção
(=) EBIT (Resultado Operacional)    ← NOVO subtotal
(+) Receitas Financeiras
(−) Despesas Financeiras
(=) Resultado Financeiro            ← NOVO subtotal
(=) LAIR (Lucro Antes de IR/CSLL)   ← NOVO subtotal
(−) IRPJ / CSLL                     ← NOVA seção
(=) Lucro Líquido do Exercício      ← renomeado (era "Resultado Líquido")
```

Linhas "Não Classificadas" continuam sendo exibidas só quando houver valor, abaixo da seção compatível (receitas → antes da Receita Líquida; despesas → antes de EBITDA).

## Mudanças por área

### 1. Banco de dados (1 migração)

Adicionar 2 novos valores válidos à coluna `categories.dre_section` (texto livre hoje, sem CHECK constraint — só precisamos refletir nos lugares que validam o set):
- `depreciacao_amortizacao`
- `tributos_sobre_lucro`

Não há tabela nova, não há mudança de RLS, não há GRANT novo. A migração serve apenas para documentar e popular categorias padrão no trigger de onboarding (se existir mapeamento), se já houver categoria "Depreciação" ou "IRPJ"/"CSLL" em algum usuário, fica a critério do usuário re-mapear via UI.

### 2. UI de Categorias (`src/components/categorias/CategoryFormModal.tsx`)

Adicionar 2 novas opções no dropdown `DRE_SECTIONS`:
- `depreciacao_amortizacao` → "Depreciação e Amortização" (sinal −)
- `tributos_sobre_lucro` → "IRPJ / CSLL (Tributos sobre o Lucro)" (sinal −)

### 3. Cálculo da DRE (`src/hooks/useDREData.ts`)

- Estender `DreSectionKey` e `VALID_SECTION_KEYS` com as duas novas chaves.
- Adicionar `sectionTrees` para elas.
- Calcular novos subtotais por período:
  - `ebitda = lucroBruto − despVendas − despOp − despGerais`
  - `ebit = ebitda − dep_amort`
  - `resultadoFinanceiro = recFin − despFin`
  - `lair = ebit + resultadoFinanceiro`
  - `lucroLiquido = lair − tributosLucro` (substitui a fórmula atual)
- Reordenar o array `sections` para o layout acima, marcando todos os novos como `isCalculated: true` (subtotais não têm `categoryRows`).
- Expandir o objeto `indicators` retornado: incluir `ebitda`, `ebit`, `resultadoFinanceiro`, `lair`, mantendo `receitaOperacional`, `lucroBruto`, `lucroLiquido`.

### 4. Tabela contábil (`src/components/relatorios/DRETableContabil.tsx`)

- Adicionar prop `showHorizontalAnalysis: boolean` (paralelo ao `showVerticalAnalysis` que já existe).
- AH%: para cada linha de valor, calcular `(periodo_atual − periodo_anterior) / |periodo_anterior| * 100`. Renderizar abaixo do valor em cor verde/vermelho ou em coluna lateral (decisão: célula compacta abaixo, em cinza/verde/vermelho, para não dobrar a largura da tabela).
- Estilizar visualmente as novas linhas calculadas (EBITDA, EBIT, Resultado Financeiro, LAIR) com a mesma faixa `bg-muted/60` já usada por Receita Líquida e Lucro Bruto. A linha final (Lucro Líquido do Exercício) mantém o destaque verde/vermelho com borda mais grossa.

### 5. Filtros (`src/pages/DRE.tsx` + `DREPeriodFilter.tsx`)

Adicionar toggle "AH% (variação)" ao lado do toggle "AV%" já existente, e propagar como prop `showHorizontalAnalysis` para a tabela.

### 6. Indicadores do topo (`src/components/relatorios/DREIndicatorCards.tsx`)

Substituir/ampliar os 4 cards:
- Receita Operacional (mantém)
- Margem Bruta % (mantém)
- **Margem EBITDA %** (novo — `EBITDA / Receita Líquida`)
- Margem Líquida % (mantém)

Remover o card duplicado "Lucratividade" (era igual a Margem Líquida).

## Notas técnicas

- Tudo continua em **regime de competência** via `competence_date` (sem mudança).
- Transferências internas continuam excluídas (sem mudança).
- AH% só aparece a partir do 2º período da grade (Jan fica em branco quando granularidade = mensal).
- AV% continua usando "Receita Líquida" como denominador para ficar alinhado à prática contábil — hoje usa Receita Operacional Bruta, ajustar nesse momento.

## Fora de escopo (próximos passos sugeridos, não nesta entrega)

- Orçado vs Realizado
- DRE comparativa multi-ano
- Trigger de onboarding criando categorias "Depreciação", "IRPJ" e "CSLL" automaticamente
- Separação Operacional × Não-Operacional (resultado não recorrente)
