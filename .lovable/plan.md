
# Redesign da página de Metas — inspirado nos Cofrinhos do MP

As referências mostram três padrões fortes que podemos adaptar sem quebrar a lógica atual (schema `goals` + `goal_movements` permanece igual):

## 1. Lista principal (`/metas`) — visão "Cofrinhos"

Substituir os cards atuais (ícone + progress bar horizontal) por uma **lista limpa estilo MP**:

- Header da página com saldo consolidado: **"R$ X,XX"** (soma de `current_amount` de todas as metas do contexto ativo) + subtítulo tipo "Guardado em N metas".
- Cada meta vira uma linha clicável com:
  - Ícone LifeBuoy dentro de círculo suave (mantém identidade EVA)
  - Nome + subtítulo "Meta: R$ X.XXX"
  - Valor atual à direita
  - Chevron para abrir o detalhe
- Botão "Nova meta" flutuante no topo.

Isso libera espaço vertical e fica muito mais escaneável no mobile (viewport atual 384px).

## 2. Página de detalhe da meta — nova rota `/metas/:id`

Hoje tudo acontece em modais empilhados. Vamos criar uma tela dedicada (como o MP faz ao tocar num cofrinho):

- Topo: nome da meta + prazo ("O prazo acaba em DD/mmm/AAAA" ou "Prazo atingido").
- **Boia grande centralizada** (reaproveita o SVG radar do `GoalCard` atual, ampliado) com o valor **R$ X** logo abaixo e a % da meta.
- **3 botões grandes lado a lado**: Reservar / Retirar / Configurar (mesmo layout dos três quadrados azul-claro da referência).
- Bloco **"Guarde dinheiro automaticamente"** com 2 cards:
  - **Por frequência** — abre modal com semanal/quinzenal/mensal + valor fixo (mapeia `auto_reserve_frequency` + `auto_reserve_amount`).
  - **Por gasto/venda** — abre modal com "R$ X por gasto" e "R$ X por venda" (mapeia `auto_reserve_per_expense` / `auto_reserve_per_sale`).
  - Cada card mostra badge **"Ativo"** (verde) quando configurado, senão **"Recomendado"** (azul suave).
- **Movimentações** (últimas 5) reaproveitando `fetchMovements`, com link "Ver todas" que abre o `GoalHistoryModal` existente.

## 3. Melhorias funcionais aproveitando o redesign

- **Estado vazio mais rico** na lista: bloco "Opções para você ganhar mais" com 2–3 cards de sugestão (Reserva de emergência 6× despesas mensais, Meta de viagem, Troca de equipamento) que pré-preenchem o formulário ao clicar.
- **Card promocional dispensável** no detalhe (estilo balão "Aproveite…") sugerindo ativar auto-reserva quando a meta ainda não tem — dismissível via localStorage.
- Botão **"Retirar"** fica desabilitado (visualmente "apagado" como na ref) quando `current_amount === 0`.
- Prazo vencido sem meta atingida mostra badge âmbar "Prazo expirado" em vez de dias restantes negativos.

## Detalhes técnicos

**Arquivos a modificar:**
- `src/pages/Metas.tsx` — nova listagem tipo "Cofrinhos" + header com saldo total.
- `src/components/metas/GoalCard.tsx` — reescrever para a linha compacta (ou renomear para `GoalListItem.tsx`).
- `src/App.tsx` — adicionar rota `/metas/:id` (dentro do `AppLayout`).

**Arquivos a criar:**
- `src/pages/MetaDetalhe.tsx` — página de detalhe descrita acima.
- `src/components/metas/GoalRadarLarge.tsx` — versão grande do anel radar (SVG reaproveitado).
- `src/components/metas/AutoReserveCard.tsx` — cards "Por frequência" / "Por gasto".
- `src/components/metas/AutoReserveFrequencyModal.tsx` e `AutoReserveByEventModal.tsx` — divide o `GoalFormModal` atual, que hoje mistura tudo.

**Sem alterações em:**
- `src/hooks/useGoals.ts` (schema e handlers permanecem).
- Tabela `goals` / `goal_movements` — nenhuma migration.
- `GoalAmountModal.tsx` / `GoalHistoryModal.tsx` — reaproveitados como estão.

**Design tokens:** manter paleta EVA (cyan `#48CAE4` no lugar do roxo MP, `bg-card` glass, `text-foreground`). Nada de hardcoded colors.
