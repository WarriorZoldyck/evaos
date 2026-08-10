# Metas: coluna espelhada "real x simulado"

## 1. Coluna de simulação espelha a coluna de contexto

Hoje a esquerda mostra os números reais (Saldo total, Média de entradas, Média de saídas, listas de categorias, Capacidade mensal estimada, Sobra estimada) e o meio mostra só os dois simuladores.

Passa a existir um espelho: tudo que existe na esquerda em versão real ganha o equivalente na coluna do meio em versão simulada.

```text
[ REAL (contexto) ]              [ SIMULAÇÃO ]
Saldo total                      Simulador de ganhos (categoria clicada)
Média de entradas  ------------> Nova média de entradas simulada
  lista de categorias              (barrinhas + valores simulados)
Média de saídas    ------------> Simulador de economia (categoria clicada)
  lista de categorias              Nova média de saídas simulada
Capacidade mensal estimada  ---> Capacidade mensal simulada
Sobra estimada até dez      ---> Sobra estimada simulada
```

- Clicar numa categoria de Entradas troca a categoria do simulador de ganhos; clicar numa de Saídas troca a do simulador de economia (comportamento atual mantido).
- Abaixo de cada simulador voltam as barrinhas de categorias, agora com o valor já simulado, para o usuário ver o impacto categoria a categoria.
- Os cards de **Capacidade mensal estimada** e **Sobra estimada** ganham gêmeos na coluna de simulação, recalculados com os cortes/aumentos aplicados, com a diferença em relação ao real destacada (ex.: `+ R$ 1.240,00/mês`).
- Rótulos deixam claro qual é qual: coluna esquerda "real", coluna do meio "simulado".

## 2. Card "Nenhum cofrinho ainda" solto no canto

O card sai de dentro do fluxo apertado da coluna central e passa a ocupar a área da direita como um card maior e destacado, com respiro em volta (ícone e título maiores, sugestões em linhas mais confortáveis), sem grudar nos painéis vizinhos.

## Cálculo dos números simulados

- Entradas simuladas = média de entradas + soma dos aumentos por categoria.
- Saídas simuladas = média de saídas − soma dos cortes por categoria.
- Capacidade mensal simulada = entradas simuladas − saídas simuladas.
- Sobra simulada = sobra atual + (capacidade simulada − capacidade atual) × meses restantes do ano.

## Detalhes técnicos

- `src/components/metas/planejamento/FinancialOverview.tsx`: extrair a lista de categorias num componente reutilizável que aceita percentuais aplicados (modo "real" x "simulado"); adicionar um bloco `SimulationSummary` com os dois cards espelhados (capacidade e sobra) recebendo os totais simulados; reintroduzir as barrinhas por categoria abaixo de cada simulador.
- `src/pages/Metas.tsx`: calcular `simulatedIncome`, `simulatedExpense`, `simulatedCapacity` e `simulatedLeftover` a partir de `incomeBoosts`/`expenseCuts` + `stats`, e renderizar na coluna do meio: simulador de ganhos → lista simulada de entradas → simulador de economia → lista simulada de saídas → cards espelhados; mover o `EmptyState` para a coluna da direita em versão maior.
- Sem mudanças de banco nem fora da página de Metas.
