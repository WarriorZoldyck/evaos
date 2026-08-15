# Planejamento Financeiro em duas camadas

Separar o módulo em dois conceitos que hoje estão misturados na mesma tela.

## Nomenclatura proposta

- **Nível 1 — Metas Orçamentárias**: o que já existe (média de entradas/saídas por categoria, metas de aumento de receita e corte de despesa, Nova Capacidade Mensal e Nova Sobra até dezembro). É o "quanto entra e quanto sai".
- **Nível 2 — Objetivos** (rótulo na UI: "Meus Objetivos"): o destino da sobra. É o "o que eu quero fazer com o dinheiro que sobra". Cada objetivo tem um tipo:
  - Reserva de emergência
  - Sonho / conquista (carro, viagem, casa)
  - Investimento
  - Dívida (quitar)
  - Outro

Esse vocabulário passa a ser usado nos componentes, no estado e nos prompts da EVA: "meta orçamentária" nunca é confundida com "objetivo".

## O que muda na tela /metas

1. A área atual (real x meta, categorias, capacidade e sobra) ganha o título **Metas Orçamentárias**.
2. Ao lado do card "Nova sobra até dez", o botão primário **"Usar o que vai sobrar"** (substitui o atual "Criar meta com base nisso", que hoje fica solto na lateral).
3. O modal aberto por esse botão passa a permitir criar um **Objetivo**:
   - Nome e tipo (reserva / sonho / investimento / dívida / outro), com ícone por tipo.
   - Alocação: **valor fixo mensal** (R$) **ou percentual da sobra projetada** (%), com prévia em reais.
   - Prazo opcional; alvo calculado a partir da alocação × meses, ou informado manualmente.
   - Barra mostrando quanto da sobra já está comprometido com outros objetivos e quanto ainda está livre (impede alocar mais que 100%).
4. Os objetivos aparecem em um painel próprio **"Meus Objetivos"**, agrupado por tipo, separado do painel orçamentário — cards com progresso, alocação mensal e status ("dentro do ritmo" / "atrasado"), reaproveitando o cálculo já existente de insight.

## Banco de dados

Migração na tabela `goals` (aditiva, sem quebrar metas existentes):

- `goal_type text not null default 'sonho'` — reserva | sonho | investimento | divida | outro
- `allocation_mode text not null default 'fixed'` — fixed | percent
- `allocation_percent numeric not null default 0` — usado quando o modo é percent
- (o valor fixo mensal continua em `auto_reserve_amount`)

Metas já criadas ficam como tipo "sonho" com alocação fixa — nenhum dado é perdido.

## Detalhes técnicos

- `src/hooks/useGoals.ts`: incluir os novos campos em `Goal`, `createGoal` e `updateGoal`.
- Novo `src/lib/allocation.ts` (puro, com testes): converte percentual ↔ valor sobre a sobra simulada, soma alocações, calcula sobra livre e valida excesso.
- `CreateGoalFromSimulationDialog.tsx` reescrito como criador de Objetivo (tipo + modo de alocação + prévia + sobra livre), substituindo a escolha atual "nova/dividir/custom".
- `GoalFormModal.tsx`: campos de tipo e modo de alocação.
- Novo `src/components/metas/planejamento/ObjectivesPanel.tsx`: lista agrupada por tipo, com progresso.
- `src/pages/Metas.tsx`: estado separado em `budget` (simulação) e `objectives` (metas persistidas); botão "Usar o que vai sobrar" junto ao card de sobra.
- Prompt da EVA (contexto de planejamento) atualizado com a distinção entre metas orçamentárias e objetivos, para as respostas usarem o vocabulário certo.
- Nada fora de `/metas`, `useGoals` e a migração é alterado.
