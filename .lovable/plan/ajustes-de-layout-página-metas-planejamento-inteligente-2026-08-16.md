# Ajustes de layout — página Metas (Planejamento Inteligente)

Baseado no vídeo: a página está "tudo muito junto/grudado", os cartões são largos demais na horizontal, sobra espaço vazio à direita e os blocos de acompanhamento da meta não têm um lugar definido.

## O que muda

### 1. Respiro e largura
- Aumentar o espaçamento entre linhas e entre colunas (hoje o grid usa gaps apertados de 10px).
- Reduzir o comprimento horizontal dos cartões de números (Saldo total, Médias, Meta de entradas/saídas) mantendo a altura atual — números e rótulos ficam alinhados sem faixas vazias.
- Ampliar a largura máxima da página de 1440px para ~1600px para aproveitar a tela e o canto direito hoje vazio.

### 2. Estrutura em 4 colunas (telas grandes)
```text
| 1. Real          | 2. Meta / Mês     | 3. Resumo        | 4. Objetivos      |
| Saldo, médias    | Metas, realizado  | Ganho total      | Meus objetivos    |
| capacidade,      | neste mês, sobra  | Meta de economia | Insight da EVA    |
| sobra real       | simulada          | régua da         | Atenção este mês  |
|                  |                   | categoria        |                   |
```
- Colunas 1 e 2 continuam pareadas linha a linha (cada número real ao lado da sua meta).
- Coluna 3 fica estreita: totais simulados e a régua de ajuste da categoria selecionada.
- Coluna 4 é nova e mais larga: lista de objetivos criados + os insights da EVA + alerta de categorias em risco, com texto maior e legível.
- Em telas médias as colunas 3 e 4 descem para baixo, empilhadas; no mobile tudo em coluna única.

### 3. Objetivos e detalhe
- Os blocos "Meta ativa", "Progresso da meta", "Conversa com a EVA" e "Plano de ação" não aparecem mais soltos no rodapé da página: eles abrem ao clicar no objetivo, na página de detalhe da meta (já implementada), preservando o planejamento feito.
- O botão redondo "+" do topo da página é removido — a criação passa a acontecer apenas pelo "Novo objetivo" dentro da coluna de Objetivos.

### 4. Consistência visual
- Padronizar raio, borda, sombra e densidade tipográfica dos cartões das quatro colunas (mesma escala de rótulo/valor), para o conjunto seguir um layout único em vez de blocos de estilos diferentes.
- Barras de progresso e badges com a mesma altura e alinhamento em todas as linhas.

## Detalhes técnicos
- `src/pages/Metas.tsx`: novo grid `xl:grid-cols-[minmax(0,1fr)_minmax(200px,240px)_minmax(300px,360px)]` com os pares real/meta na primeira faixa, `gap` aumentado, container `max-w-[1600px]`, remoção do botão `+` do cabeçalho, movimentação de `GoalInsightCard` e `MonthRiskCard` para a coluna de Objetivos.
- `src/components/metas/planejamento/FinancialOverview.tsx`: ajuste de padding/tamanho dos cartões (`FinancialMetricCard` e derivados) e do `PairRow` para reduzir a largura útil sem alterar cálculo.
- `src/components/metas/planejamento/ObjectivesPanel.tsx`: aceita conteúdo extra abaixo da lista (insights) e ganha largura maior.
- Nenhuma mudança em cálculo, persistência (`useBudgetTargets`) ou banco de dados.

## Fora deste escopo
- Reformulação do chat da EVA (o usuário disse que vai mandar um código para isso depois).
- Fluxo de reserva automática ao criar meta.
