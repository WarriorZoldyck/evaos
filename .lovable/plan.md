# Metas — simulador com slider, categorias lado a lado e resumo na lateral

## 1. Painel de ajuste sai do meio e vai para a lateral

Hoje o card verde ("Ganho total na meta" / "Economia total na meta") aparece dentro da coluna Meta, empurrando a lista e desalinhando as colunas.

- Ao abrir "Média de entradas", o painel de ajuste da categoria passa a ser renderizado na **coluna lateral direita**, logo abaixo do botão "Criar meta com base nisso". Mesmo comportamento para saídas.
- Com isso as colunas Real e Meta voltam a ficar exatamente na mesma altura, linha a linha.

## 2. Controle por deslize (slider) + campo digitável

- O ajuste da categoria volta a ter um **slider** como controle principal, permitindo variação para mais e para menos.
- Abaixo do slider ficam os campos digitáveis (R$ com máscara e % com sinal), sincronizados com ele em tempo real.
- Os botões − / + saem; quem quiser precisão usa o campo digitável.

## 3. Categorias lado a lado (real x simulada)

Quando um bloco está aberto, cada categoria aparece na mesma linha nos dois lados:

```text
Real (esquerda)                Meta (direita)
Alimentação   R$ 7.316,82  <-> Alimentação   R$ 5.853,45  (−20%)
Moradia       R$ 6.150,87  <-> Moradia       R$ 6.150,87  (0%)
```

A ordem e a altura das linhas são idênticas nos dois lados, e a categoria selecionada fica destacada em ambos — o usuário vê imediatamente o comparativo do que está mexendo.

## 4. Remoção do card verde redundante

- O bloco verde "Economia total na meta" / "Ganho total na meta" (dentro do painel) é **removido**: já existem os cards "Meta de economia" e "Ganho total" na lateral.
- O painel de ajuste passa a mostrar só: nome da categoria, média atual, novo valor da categoria e a nova média do bloco.

## 5. Cards de resumo viram atalho para o plano

- Clicar em **"Meta de economia"** abre um painel com o plano montado: lista das categorias com corte, valor cortado em cada uma, total por mês e projeção anual.
- Clicar em **"Ganho total"** abre o equivalente para as entradas aumentadas.
- Enquanto não houver nenhum ajuste, o card mostra um aviso curto de que ainda não há plano.

## Detalhes técnicos

- `src/pages/Metas.tsx`: o `OverviewDetailPanel` deixa de ser renderizado dentro do `PairRow` da coluna Meta e passa para o `aside`, abaixo de `CreateGoalFromSimulation`, condicionado ao `openBlock`. As linhas de categoria dos dois lados passam a ser renderizadas por um único componente pareado.
- `src/components/metas/planejamento/FinancialOverview.tsx`:
  - novo `PairedCategoryList` que recebe `items` + `percents` e renderiza real e simulado em duas colunas alinhadas, substituindo o par `CategoryList` / `SimulatedCategoryList` quando o bloco está aberto (componentes antigos mantidos para o caso fechado ou removidos se ficarem sem uso).
  - `OverviewDetailPanel`: adiciona `Slider` (shadcn) com faixa de −100% a +100% para saídas e −100% a +300% para entradas, mantendo os inputs R$ e %; remove os botões `nudge` e o bloco verde de totais.
  - `GainTotalCard` / `SavingGoalCard` ganham `onClick` e recebem a lista de categorias ajustadas para exibir o detalhamento em um `Collapsible`/`Popover`.
- Sem mudanças de cálculo financeiro, banco de dados ou arquivos fora de `/metas`.
