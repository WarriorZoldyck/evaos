# EVA responde a pergunta que foi feita (período específico + meta por categoria)

## O que aconteceu com o espclin

Nas mensagens de 20/08 e 21/08 (tabela `whatsapp_messages` do perfil com WhatsApp final 99989901), a EVA:

- Respondeu "Gastos com Alimentação **este mês**" com 20 lançamentos de 21/08/2026 — ou seja, ignorou "julho de 2026" e usou o mês atual.
- Não respondeu nada sobre "meta de lazer": as respostas de metas são sempre o painel geral do mês (Entradas/Saídas/Sobra + categorias dentro da meta), sem consulta a uma categoria nomeada.

Três causas confirmadas no código do `whatsapp-webhook`:

1. **Não existe período por mês/ano.** O `period_filter` só aceita `mes_atual | mes_passado | ultimos_7_dias | ultimos_30_dias | ultimos_90_dias | null`. "julho de 2026", "em março", "no 1º semestre" não têm como ser representados, então caem no default `mes_atual`.
2. **Metas não têm consulta por categoria.** O `query_type: "metas_mes"` sempre monta o relatório completo do mês; não há caminho para "qual é a meta de Lazer / quanto já gastei dela".
3. **Total errado por causa do limite de 20.** Em `gastos_categoria` o total é somado sobre a mesma query limitada a 20 linhas — por isso "Total: R$ 1.401,89 (20 lançamentos)". Se houver mais de 20 no período, o total mostrado está incorreto.

Bônus da mesma conversa: quando a mensagem faz **duas perguntas** (gasto de julho + meta de lazer), só uma é atendida — o classificador devolve um único intent.

## O que vou mudar

### 1. Período livre (mês/ano, intervalo, trimestre)

- Adicionar `date_from` e `date_to` (YYYY-MM-DD) ao JSON de consulta e instruir o modelo a preenchê-los sempre que o usuário citar um mês, ano ou intervalo explícito ("julho de 2026", "de 01/06 a 15/06", "esse ano").
- `resolvePeriod()` passa a priorizar `date_from`/`date_to` quando presentes e gera um rótulo legível ("julho/2026"), mantendo os presets atuais como fallback.
- O prompt ganha a data de hoje já disponível para resolver mês sem ano (mês citado no futuro → ano anterior).

### 2. Meta de uma categoria específica

- Novo `query_type: "meta_categoria"` que usa `category_filter`.
- Resposta determinística: meta do mês daquela categoria (de `budget_targets`), quanto já foi realizado no mês (reaproveitando o cálculo de progresso já usado no relatório de metas), quanto falta / quanto excedeu e o % do mês decorrido. Se não houver meta cadastrada, responde exatamente isso e informa o realizado mesmo assim.
- O prompt aprende a diferença: "como estão minhas metas" → `metas_mes`; "qual a meta de Lazer", "quanto ainda posso gastar em Alimentação" → `meta_categoria`.

### 3. Corrigir o total truncado

- Em `gastos_categoria` (e `listar_lancamentos`), calcular o total com uma agregação sem o `limit(20)`, e continuar listando só os 20 mais recentes com um rodapé "mostrando 20 de N".

### 4. Perguntas múltiplas na mesma mensagem

- Permitir que o classificador devolva `follow_up_queries`: uma lista curta (máx. 3) de consultas adicionais no mesmo formato de `consulta`.
- O webhook executa cada uma e concatena os blocos de resposta, reaproveitando a divisão em partes já existente para WhatsApp.

### 5. Mesmo comportamento no chat do app

- Replicar período livre, `meta_categoria` e o fix do total no `eva-chat`, para as respostas do app e do WhatsApp continuarem idênticas.

## Detalhes técnicos

- `supabase/functions/whatsapp-webhook/index.ts`: prompt de consulta (novos campos `date_from`/`date_to`, `meta_categoria`, `follow_up_queries`), `VALID_QUERY_TYPES`, `resolvePeriod()`, cases `gastos_categoria`, `listar_lancamentos`, novo case `meta_categoria`, loop de follow-ups antes do envio.
- `supabase/functions/eva-chat/index.ts`: mesmos ajustes de período e o novo tipo de consulta.
- `supabase/functions/_shared/budgetMonthReport.ts`: extrair/expor o cálculo por categoria para o novo case reutilizar sem duplicar regra.
- Sem mudança de banco; `budget_targets` já tem tudo que é necessário.
- Deploy das duas Edge Functions ao final e teste com "quanto gastei em alimentação em julho de 2026?" e "qual a meta de lazer?".
