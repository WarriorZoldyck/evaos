# Metas: simulação lado a lado, sem cards duplicados

## 1. Cada card real ganha o par simulado na mesma linha

Hoje a coluna do meio empilha simulador + card de média simulada + lista simulada + simulador + card + lista + resumo, o que duplica cards e desalinha tudo.

Passa a ser um layout em linhas pareadas: à esquerda o número real, à direita, na mesma altura, o simulado.

```text
[ REAL ]                        [ SIMULADO ]
Saldo total                     —
Média de entradas/mês   <---->  Simulador de ganhos (categoria clicada)
  lista de categorias             lista de entradas simuladas
Média de saídas/mês     <---->  Simulador de economia (categoria clicada)
  lista de categorias             lista de saídas simuladas
Capacidade mensal       <---->  Capacidade mensal simulada
Sobra até dez           <---->  Sobra simulada até dez
```

- Os cards "Média de entradas simulada" e "Média de saídas simulada" da coluna do meio saem: o próprio simulador já mostra o novo valor. Fica só o par de baixo (capacidade e sobra).
- Nada abre nem fecha para aparecer: o simulador correspondente já nasce ao lado do card real, alinhado no topo dele. Clicar numa categoria só troca qual categoria está sendo simulada.

## 2. Entrada de valor mais direta no simulador

- O slider deixa de ser obrigatório: cada simulador passa a ter dois campos lado a lado — **valor alvo em R$** (com máscara) e **percentual** (digitável, com setas de aumentar/diminuir).
- Alterar um atualiza o outro automaticamente. O slider é removido, já que o percentual digitável cumpre o mesmo papel sem travar em limite.
- Entradas continuam sem teto de percentual; saídas continuam limitadas a 100% de corte.

## 3. Um único botão de criar meta

- Os dois botões ("Criar meta de ganhos" / "Criar meta com essa economia") viram **um só**, no bloco de resultado simulado, que já soma o ganho simulado + a economia simulada como aporte mensal da nova meta.
- O card grande "Nenhum cofrinho ainda" sai da tela; a criação de cofrinho fica pelo botão "+" que já existe no topo da página, liberando a terceira coluna.

## 4. Capacidade mensal simulada negativa

O card real usa `Math.max(0, entradas − saídas)`, então mostra R$ 0,00 quando as saídas superam as entradas; o card simulado usa a diferença crua e por isso aparece negativo mesmo sem nenhuma simulação aplicada. Os dois passam a usar a mesma base (valor real, podendo ser negativo, marcado em vermelho), para que a comparação faça sentido.

## Detalhes técnicos

- `src/pages/Metas.tsx`: trocar a grid de 3 colunas por uma grid de 2 colunas pareadas (real | simulado) usando linhas (`grid grid-cols-2` com cada par numa row) para garantir alinhamento por altura; remover os dois `FinancialMetricCard` de médias simuladas; remover o `EmptyState` e sua renderização; passar `monthlyCapacityRaw = avgIncomeMonth − avgSpentMonth` para o card real e para `SimulationSummary`.
- `src/components/metas/planejamento/FinancialOverview.tsx`: quebrar `FinancialOverview` em partes renderizáveis por linha (saldo, card entradas + lista, card saídas + lista, capacidade, sobra) para poderem ser pareadas na grid; no `OverviewDetailPanel` remover o `Slider` e adicionar campo de percentual numérico com spinners nativos ao lado do campo em R$; mover o botão de criar meta para fora dos painéis.
- `SimulationSummary` recebe também os totais simulados de ganho e economia e renderiza o botão único "Criar meta com base nisso".
- Sem mudanças de banco nem fora da página de Metas.
