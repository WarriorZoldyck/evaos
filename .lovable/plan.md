# Metas Orçamentárias: coluna "Realizado no mês" + acompanhamento no WhatsApp

Hoje a página compara duas colunas: **Real** (média histórica) e **Meta** (simulação). Falta a informação mais prática: *o que já aconteceu neste mês*. E a simulação vive só na tela — nada é salvo, então a EVA não tem como responder no WhatsApp com base nela.

## 1. Salvar as metas orçamentárias

Nova tabela `budget_targets` (por usuário e contexto Pessoal/Empresa): categoria, tipo (entrada/saída) e o **valor alvo mensal**. Ao mexer no slider de uma categoria, o alvo é salvo automaticamente (com debounce) e volta ao recarregar a página.

Quando a categoria ainda não tem meta definida, o alvo usado é a **média mensal histórica** dela (conforme sua escolha), marcada visualmente como "alvo automático".

## 2. Quarta coluna: Realizado no mês

A lista de categorias passa a ter, por linha:

```text
Categoria      Média/mês      Meta/mês      Realizado no mês
ALIMENTAÇÃO    R$ 1.200       R$ 900        R$ 740  ▓▓▓▓▓░░  82%  faltam R$ 160
```

Regras:
- Realizado = soma dos lançamentos **efetivados (pagos)** da categoria no mês corrente, no contexto selecionado, sem transferências internas.
- Saídas: barra de consumo da meta. Verde até 70%, âmbar de 70% a 100% ("está se aproximando"), vermelho acima de 100% ("estourou em R$ X").
- Entradas: barra de alcance. Mostra "faltam R$ X para a meta de R$ Y" (ex.: meta 55 mil, recebido 30 mil → faltam 25 mil).
- Também aparece um indicador de **ritmo**: comparando o quanto do mês já passou com o quanto da meta já foi usado, para dizer "no ritmo" ou "gastando rápido demais".

Nos cards de topo (entradas / saídas) entra a mesma coluna com o total realizado do mês.

## 3. Onde não dá para gastar mais

Um card novo na lateral, "Atenção este mês", lista as categorias de saída ordenadas por risco: as que já estouraram, depois as que passaram de 80% da meta, com o valor exato que ainda cabe em cada uma. É o "no que não posso gastar mais" em texto direto, sem IA — números batendo exatamente com a tela.

## 4. EVA no WhatsApp

- **Sob demanda**: perguntas como "como estou este mês?", "quanto falta pra minha meta?", "posso gastar em alimentação?" passam a ser respondidas com meta x realizado x quanto falta, categoria a categoria, usando exatamente os mesmos números da tela.
- **Resumo semanal**: toda segunda de manhã a EVA envia um resumo: quanto já entrou e saiu no mês, percentual da meta consumido, as categorias em risco e o que ainda sobra. Só recebe quem tem WhatsApp configurado e alguma meta orçamentária (ou histórico suficiente para o alvo automático).

## Detalhes técnicos

- **Migração**: tabela `public.budget_targets` (`id`, `user_id`, `company_id`, `category_name`, `kind` income/expense, `target_amount`, `created_at`, `updated_at`), unique por (`user_id`, `company_id`, `category_name`, `kind`), com GRANTs para `authenticated`/`service_role`, RLS por `auth.uid()` + acesso de membros do hub via `is_hub_member`, e leitura pelo `service_role` para o cron.
- **Hook novo** `useBudgetTargets.ts` (CRUD + upsert com debounce) e `useMonthProgress.ts` (realizado do mês por categoria: `transactions` do mês corrente, `status = 'Pago'`, contexto aplicado, `is_internal_transfer` excluído).
- **Lógica pura** em `src/lib/budgetProgress.ts`: `buildCategoryProgress()` (realizado, alvo efetivo, restante, % consumido, status ok/near/over, ritmo pace) e `buildRiskList()`. Testes com Vitest cobrindo alvo automático, estouro, entradas e virada de mês.
- **UI**: `PairedCategoryList` em `FinancialOverview.tsx` ganha a terceira coluna de realizado; novo `MonthRiskCard.tsx` na `aside` de `src/pages/Metas.tsx`. Sem mudanças fora de `/metas` a não ser os arquivos citados.
- **WhatsApp**: novo `query_type` `metas_mes` no prompt e no switch de `supabase/functions/whatsapp-webhook/index.ts`, reaproveitando a mesma lógica de `budgetProgress` portada para `supabase/functions/_shared/budgetProgress.ts`.
- **Cron**: nova função `budget-weekly-summary` protegida por `CRON_SECRET`, agendada via `pg_cron` para segunda 09:00 (America/Sao_Paulo), enviando pela Evolution API como as demais mensagens.
