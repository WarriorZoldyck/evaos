# Metas com categoria automática + ajustes na Precificação

Duas frentes desta rodada. Precificação de produtos (CMV, ponto de equilíbrio, estoque) e taxas da maquininha na calculadora de parcelamento ficam para uma próxima etapa.

## 1. Metas geram categoria automaticamente

Ao criar um objetivo (reserva de emergência, carro, viagem…), o sistema cria sozinho:

- a categoria raiz **Metas** (só se ainda não existir no contexto atual — Pessoal ou Empresa);
- uma **subcategoria com o nome do objetivo** dentro de Metas.

Assim o usuário consegue, no lançamento de transferência entre contas, escolher `Metas > Reserva de emergência`.

Renomear o objetivo renomeia a subcategoria. Excluir o objetivo **não** apaga a subcategoria (histórico dos lançamentos fica preservado); o usuário exclui manualmente se quiser.

## 2. Transferência categorizada abastece a meta

Quando existe uma transferência entre contas categorizada como `Metas > [objetivo]`, o valor entra automaticamente no progresso daquele objetivo — a barra e o gráfico param de depender de lançamento manual.

- O progresso passa a ser: aportes manuais já registrados + soma das transferências categorizadas na subcategoria do objetivo.
- Continua fora do faturamento e da DRE (transferência interna já é excluída hoje; a regra não muda).
- No detalhe do objetivo, uma linha mostra quanto veio de lançamentos e quanto de aportes manuais.

## 3. Objetivo em modo anual

No formulário do objetivo, além do valor mensal, uma opção **"Pensar no ano"**: o usuário informa o valor total desejado e o prazo (em meses ou uma data), e o sistema calcula e preenche o valor mensal necessário. Continua sendo possível digitar direto o mensal — os dois campos ficam sincronizados.

## 4. Precificação — lucratividade fixa na quantidade

Hoje, mexer na **quantidade** recalcula e muda a lucratividade exibida. Passa a ser:

- **Quantidade**: mantém a lucratividade % fixa; o preço é reajustado para preservar a margem.
- **Preço**: recalcula a lucratividade (como hoje).
- **Tempo**: recalcula a lucratividade (como hoje).
- **Lucratividade**: recalcula o preço (como hoje).

## 5. Precificação — ajustes de tela

- Tabela de Procedimentos mostrando **5 linhas** antes de rolar (hoje ~3).
- **Botão de editar visível** em cada linha (não só dentro do menu "…"), para trocar nome e dados do procedimento.
- Corrigir o scroll do bloco de **detalhes** do procedimento, que hoje corta conteúdo e esconde a barra de rolagem.
- Mover o **card de calendário / horas do mês** para o topo da página, acima dos demais resumos.

## Detalhes técnicos

- `src/hooks/useGoals.ts`: em `createGoal`/`updateGoal`, garantir categoria raiz "Metas" (`type` compatível, `company_id` do contexto) e subcategoria com o nome da meta, reaproveitando `createCategory` de `useCategories`. Guardar o vínculo pelo par (nome da meta, categoria pai) — sem coluna nova; se a resolução por nome se mostrar frágil no código atual, adicionar `goals.category_id` via migração.
- Progresso: novo hook (ou extensão de `useGoals`) somando `transactions` com `category='Metas'` e `subcategory = nome do objetivo`, restrito ao contexto e a `is_internal_transfer = true`; exibir em `GoalProgressPanel.tsx` / `GoalCard.tsx` / `GoalRadarLarge.tsx`. `goal_movements` continua para aportes manuais, sem duplicar.
- Modo anual: campos locais em `GoalFormModal.tsx` (total + prazo) derivando `auto_reserve_amount`; sem mudança de schema.
- `src/components/precificacao-v2/ProcedureTableV2.tsx`: no `onCommit` da quantidade, capturar `lucratividadePct` antes da mudança e reaplicar via `applyMargin` com o novo `calcParts`; adicionar botão `Edit` inline na coluna de ações.
- `src/pages/PrecificacaoV2.tsx`: `max-h` da tabela de ~288px para ~440px; reordenar seções para o card de calendário/horas ficar no topo; revisar `overflow` do painel de detalhes.
