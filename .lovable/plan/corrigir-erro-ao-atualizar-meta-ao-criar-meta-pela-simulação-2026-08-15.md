# Corrigir "Erro ao atualizar meta" ao criar meta pela simulação

## O que está acontecendo

Quando a meta é criada a partir da simulação, a página monta um objeto de meta "falso" (com identificador vazio) só para preencher o formulário. O formulário interpreta isso como edição de uma meta existente e tenta **atualizar** um registro que não existe, usando um identificador inválido — o banco recusa e aparece "Erro ao atualizar meta". Por isso o título do modal também aparece como "Configurar Meta" em vez de "Nova Meta".

Confirmado na investigação: a tabela de metas tem permissões e políticas corretas, e não há restrições de dados bloqueando o salvamento. O problema é só o fluxo de preenchimento.

## Correção

1. Separar "meta em edição" de "valores pré-preenchidos" no formulário de meta:
   - novo campo opcional de valores iniciais (nome, valor-alvo, prazo, aporte mensal);
   - quando vier só o pré-preenchimento, o modal mostra "Nova Meta" e usa o caminho de **criação**.
2. A página de Metas deixa de fabricar uma meta falsa: passa o pré-preenchimento pelo novo campo e mantém "meta em edição" nula.
3. Garantir que a criação salve também os campos de reserva automática (hoje a criação ignora frequência/valor de aporte), para que o aporte mensal vindo da simulação não se perca.

## Detalhes técnicos

- `src/components/metas/GoalFormModal.tsx`: nova prop `prefill` (nome, alvo, prazo, aporte). `editGoal` volta a significar apenas meta persistida. Efeito de inicialização aplica `editGoal` ou `prefill`.
- `src/pages/Metas.tsx`: remove o objeto `as Goal` com `id: ""`; passa `prefill` diretamente e `editGoal={null}` nesse fluxo.
- `src/hooks/useGoals.ts`: `createGoal` passa a aceitar e persistir `auto_reserve_enabled`, `auto_reserve_frequency`, `auto_reserve_amount`, `auto_reserve_per_expense`, `auto_reserve_per_sale`.
- Verificação: criar meta pela simulação (deve salvar sem erro e aparecer na lista) e editar meta existente (deve continuar usando atualização).
