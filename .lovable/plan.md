

# Reestruturação do DRE — Formato Contábil Padrão

## Problema atual

O DRE atual tem apenas 3 linhas:
- (+) RECEITAS (agrupadas por categoria)
- (-) DESPESAS (agrupadas por categoria)
- = RESULTADO

Isso **não** segue a estrutura contábil padrão da DRE conforme a planilha e o material fornecido.

## Estrutura-alvo (baseada na planilha)

A nova DRE terá linhas fixas contábeis, com as categorias do usuário mapeadas para cada seção:

```text
(+) Receita Operacional          ← soma de todas as receitas
(-) Impostos sobre a venda       ← categorias de impostos sobre venda
(=) Receita Líquida              ← calculado
(-) Custo das mercadorias/serv.  ← categorias de CMV/CPV/CSP
(=) Lucro Bruto                  ← calculado
(-) Despesas com vendas           ← categorias de desp. vendas
(-) Despesas operacionais/adm     ← categorias operacionais
(-) Despesas financeiras          ← categorias financeiras
(+) Receita financeira            ← categorias de receita financeira
(-) Despesas gerais e adm         ← demais despesas
(=) Lucro Líquido                ← calculado (resultado final)
```

## Como mapear categorias automaticamente

O sistema não tem hoje um campo `dre_section` nas categorias. Para resolver isso sem exigir migração complexa:

1. **Mapeamento por nome** com heurísticas (palavras-chave): categorias que contenham "imposto", "tributo", "ISS", "ICMS" etc. vão para "Impostos sobre venda". Categorias com "comissão", "frete" vão para "Despesas com vendas". Etc.

2. **Fallback inteligente**: categorias de receita que não casam vão para "Receita Operacional". Categorias de despesa que não casam vão para "Despesas gerais e adm".

3. **Futuramente**: adicionar campo `dre_section` na tabela `categories` para o usuário personalizar (não nesta fase).

## Implementação

### 1. `useDREData.ts` — Reestruturar saída

Em vez de retornar `revenueRows` e `expenseRows` como árvores de categorias, retornar um objeto com as **seções fixas da DRE**, cada uma contendo seus totais por período e as linhas de categoria dentro dela:

```typescript
interface DRESection {
  key: string;           // "receita_operacional", "impostos_venda", etc.
  label: string;         // "(+) Receita Operacional"
  type: "sum" | "sub" | "result"; // soma, subtração, ou resultado calculado
  monthlyTotals: Record<string, number>;
  categoryRows: DRECategoryRow[];  // categorias dentro desta seção (colapsáveis)
  isCalculated: boolean; // linhas como "Receita Líquida" não têm categorias
}
```

Função de classificação por palavras-chave:
- **Impostos sobre venda**: imposto, tributo, ISS, ICMS, PIS, COFINS, simples nacional
- **CMV/CPV/CSP**: custo de mercadoria, CMV, CPV, CSP, matéria-prima, insumo
- **Despesas com vendas**: comissão, frete de venda, propaganda, marketing, publicidade
- **Despesas financeiras**: juros, tarifa bancária, IOF, taxa bancária, multa
- **Receita financeira**: rendimento, aplicação, juros recebidos (tipo receita + keywords)
- **Despesas operacionais/adm**: aluguel, energia, água, salário, pro-labore, contabilidade, software, internet, telefone
- **Fallback**: receita → Receita Operacional; despesa → Despesas gerais e adm

### 2. `DRETable.tsx` — Layout contábil

Redesenhar a tabela para mostrar as linhas fixas da DRE na ordem correta:
- Linhas de seção (colapsáveis, mostram categorias dentro)
- Linhas de resultado (calculadas, destacadas com fundo)
- Análise vertical: coluna extra de `%` em relação à Receita Operacional
- Análise horizontal: tooltip ou indicador mostrando variação vs período anterior

### 3. `DRE.tsx` — Adicionar indicadores

Abaixo da tabela principal, cards com:
- **Lucratividade**: (Lucro Líquido / Receita Operacional) x 100
- **Margem de Contribuição**: Lucro Bruto - Despesas Variáveis
- **Margem Bruta %**: (Lucro Bruto / Receita Operacional) x 100
- **Margem Líquida %**: (Lucro Líquido / Receita Operacional) x 100

### 4. Toggle Gerencial vs Contábil

Adicionar um switch no filtro para alternar entre:
- **Contábil**: estrutura fixa padrão descrita acima
- **Gerencial**: visão atual por categorias (receitas vs despesas simples)

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDREData.ts` | Nova interface `DRESection[]`, função de classificação por keywords, cálculo de linhas intermediárias |
| `src/components/relatorios/DRETable.tsx` | Novo layout com linhas fixas contábeis, coluna de % (análise vertical), seções colapsáveis |
| `src/components/relatorios/DREPeriodFilter.tsx` | Toggle "Contábil / Gerencial" |
| `src/pages/DRE.tsx` | Cards de indicadores financeiros (Lucratividade, Margem Bruta, Margem Líquida, Margem de Contribuição) |

## Resultado visual esperado

```text
┌─────────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ DRE                     │   Jan    │   Fev    │   Mar    │  Total   │
├─────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ (+) Receita Operacional │ 50.000   │ 48.000   │ 55.000   │ 153.000  │
│   ▸ Consultas           │ 30.000   │ 28.000   │ 35.000   │  93.000  │
│   ▸ Procedimentos       │ 20.000   │ 20.000   │ 20.000   │  60.000  │
│ (-) Impostos s/ venda   │ -4.220   │ -4.051   │ -4.642   │ -12.913  │
│ (=) Receita Líquida     │ 45.780   │ 43.949   │ 50.358   │ 140.087  │
│ (-) CMV/CSP             │ -5.000   │ -4.800   │ -5.500   │ -15.300  │
│ (=) Lucro Bruto         │ 40.780   │ 39.149   │ 44.858   │ 124.787  │
│ (-) Desp. com vendas    │ -2.000   │ -1.500   │ -2.500   │  -6.000  │
│ (-) Desp. operacionais  │-15.000   │-15.000   │-15.000   │ -45.000  │
│ (-) Desp. financeiras   │   -800   │   -750   │   -900   │  -2.450  │
│ (+) Receita financeira  │    200   │    180   │    250   │     630  │
│ (-) Desp. gerais e adm  │ -3.000   │ -3.000   │ -3.000   │  -9.000  │
│ (=) Lucro Líquido       │ 20.180   │ 19.079   │ 23.708   │  62.967  │
└─────────────────────────┴──────────┴──────────┴──────────┴──────────┘

 Lucratividade: 41,2%  │  Margem Bruta: 81,6%  │  Margem Líquida: 41,2%
```

