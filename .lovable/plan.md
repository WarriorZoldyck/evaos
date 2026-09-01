# Calendário de jornada no estilo Google Agenda

O card de jornada na Precificação passa a ter um calendário em modal, mais bonito e com **dia + faixa de horário**, além de navegação entre meses.

## 1. Card compacto (na página)

O card do topo deixa de mostrar o mini-calendário. Ele mostra apenas o resumo:

- Mês de referência (com setas para trocar de mês)
- Dias trabalhados · Horas disponíveis · Horas produtivas
- Campos de perda produtiva (%), salas e alíquota
- Botão **Editar jornada** → abre o modal

## 2. Modal do calendário

Layout em duas partes, inspirado no Google Agenda:

```text
+--------------------------------------------------+
|  <   Setembro 2026   >              [Salvar]     |
+---------------------------+----------------------+
|  D  S  T  Q  Q  S  S      |  Terça, 8 de set.    |
|  .. grade do mês ..       |  Início  [08:00]     |
|  cada dia mostra a        |  Fim     [18:00]     |
|  faixa (ex. 8h–18h)       |  Intervalo [01:00]   |
|  dias de folga em cinza   |  = 9h no dia         |
|                           |  [ ] Folga / feriado |
|                           |  [Aplicar a todas as |
|                           |   terças do mês]     |
+---------------------------+----------------------+
|  Padrão da semana: S T Q Q S S D + 08:00–18:00   |
|  Total: 22 dias · 198h disponíveis · 158,4h prod.|
+--------------------------------------------------+
```

Comportamento:

- **Padrão semanal**: o usuário marca os dias da semana que trabalha e define a faixa padrão (início, fim, intervalo). Todos os dias do mês herdam isso.
- **Clique em um dia**: abre o painel lateral para ajustar aquele dia específico — horário diferente, meio período, ou marcar como folga/feriado.
- **Aplicar a todas as [terças]**: replica a faixa do dia para o mesmo dia da semana no mês.
- **Navegação de meses**: setas no topo; as horas recalculadas são as do mês selecionado.
- Cada célula mostra a faixa horária e o total de horas do dia; folgas ficam esmaecidas.
- Rodapé sempre com o total do mês: dias, horas disponíveis e horas produtivas (já com a perda).

## 3. Cálculo

- Horas do dia = (fim − início) − intervalo.
- Horas disponíveis do mês = soma dos dias ativos.
- Horas produtivas = disponíveis × (1 − perda%) — mantém o comportamento atual.
- Custo/hora, FMM e lucratividade continuam usando as horas produtivas.
- O CF do procedimento permanece como está hoje (tempo × custo/hora por sala) — sem alteração.

## Detalhes técnicos

- Migração em `pricing_v2_configurations`:
  - `weekday_schedule jsonb default '{}'` — `{ "1": {"start":"08:00","end":"18:00","break":60}, ... }`
  - `day_overrides jsonb default '{}'` — `{ "2026-09-08": {"start":"08:00","end":"12:00","break":0} , "2026-09-07": null }` (null = folga)
  - `reference_month text` — `YYYY-MM` do mês selecionado.
  - `excluded_days` e `hours_per_day` continuam existindo para compatibilidade; a migração de leitura converte o formato antigo (weekdays + horas/dia + excluídos) no novo na primeira abertura.
  - GRANTs e RLS já existentes da tabela permanecem.
- `src/lib/workHours.ts` ganha funções puras + testes: `dayHours(range)`, `monthSchedule(year, month, weekdaySchedule, overrides)`, `availableHoursFromSchedule(...)`, mantendo `productiveHours` como está.
- Novo `src/components/precificacao-v2/WorkScheduleModal.tsx` (Dialog do shadcn) com grade do mês própria (não o `Calendar`, para caber a faixa horária em cada célula), painel lateral de edição e navegação de mês.
- `ConfigCard.tsx` simplifica: resumo + botão que abre o modal; mantém perda produtiva, salas e alíquota.
- `usePricingV2.ts`: `availableHoursMonth` passa a vir de `availableHoursFromSchedule` do mês de referência; `saveConfig` grava os novos campos.
- `CostSummaryCards.tsx`: sem mudança de estrutura, apenas segue exibindo disponíveis vs produtivas.
