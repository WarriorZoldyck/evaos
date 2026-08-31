# Precificação — perda produtiva e calendário de horas

Foco desta rodada: como as **horas do mês** são calculadas. Hoje o card de Configuração Geral usa `dias/semana × horas/dia × 4,33`, uma média que não reflete o mês real e não considera tempo improdutivo (intervalos, faltas, buracos na agenda).

## 1. Calendário do mês

Substituir a média fixa de 4,33 por um calendário real:

- O usuário escolhe **quais dias da semana trabalha** (S T Q Q S S D) e as **horas por dia**.
- O sistema conta os dias úteis reais do mês selecionado (ex.: setembro/2026 tem 22 segundas-a-sextas) e mostra o mês de referência.
- Um mini-calendário mostra os dias contados; o usuário pode **desmarcar dias específicos** (feriados, folgas) clicando neles.
- Resultado: **Horas disponíveis no mês** = (dias marcados) × horas/dia.
- Continua sendo possível digitar as horas manualmente, sobrescrevendo o cálculo.

## 2. Perda produtiva (%)

Novo campo **% de perda produtiva** no mesmo card:

- Representa o tempo que existe na agenda mas não vira serviço faturado (encaixes vazios, limpeza entre atendimentos, deslocamento, atraso).
- **Horas produtivas = horas disponíveis × (1 − perda%)**.
- O card passa a mostrar as duas linhas: horas disponíveis e horas produtivas, com a diferença em horas.
- **Todo o cálculo de custo/hora, FMM e lucratividade passa a usar as horas produtivas**, não as disponíveis. Ou seja: aumentar a perda encarece a hora e sobe o preço sugerido — que é o comportamento correto.
- Valor padrão 0% para não alterar os números de quem já usa; quem preencher vê o impacto imediato nos cards de resumo e na tabela de procedimentos.

## 3. Onde aparece

O card de calendário/horas já está no topo da página. Ele passa a concentrar: dias trabalhados, horas/dia, calendário do mês, perda produtiva, horas disponíveis e horas produtivas — em um bloco único e legível.

## Detalhes técnicas

- Migração em `pricing_v2_configurations`: colunas `productive_loss_pct numeric default 0` e `excluded_days jsonb default '[]'` (datas ISO desmarcadas no calendário). Sem novas tabelas; GRANTs e RLS seguem o padrão já existente da tabela.
- Nova lib pura `src/lib/workHours.ts` com testes: `countWorkingDays(year, month, weekdays, excludedDates)`, `availableHours(...)`, `productiveHours(available, lossPct)`.
- `src/components/precificacao-v2/ConfigCard.tsx`: troca de dias/semana numérico por toggles de dias da semana, mini-calendário (`Calendar` do shadcn, `mode="multiple"`, `pointer-events-auto`), campo de perda %, e exibição das duas linhas de horas.
- `src/hooks/usePricingV2.ts`: `hoursPerMonth` efetivo passa a ser o valor produtivo; `custoHora`, `fmm`, `custoHoraPorSala` e `calcParts` consomem esse número sem mudança de fórmula.
- `src/components/precificacao-v2/CostSummaryCards.tsx`: mostrar horas produtivas (e as disponíveis como referência secundária).
