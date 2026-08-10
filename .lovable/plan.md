# Metas — ajustes no simulador lateral

## O que muda

**1. Painel abre na mesma altura do card clicado**
Hoje o simulador lateral começa no topo da coluna, desalinhado do card "Média de saídas / mês". Ele passa a alinhar o topo com o bloco do card de origem (saídas ou entradas), acompanhando o scroll da lista.

**2. Cards da esquerda mais estreitos**
A coluna de contexto reduz de 300px para ~240px (e ~230px quando o painel está aberto), sobrando mais espaço para o painel e para a área central.

**3. Economia total mais visível**
A soma de todas as categorias simuladas ganha destaque:
- Uma faixa fixa no rodapé da lista de saídas mostrando "Economia total simulada: R$ X/mês · R$ Y em 12 meses", visível mesmo com o painel fechado.
- No painel, o total das categorias deixa de ser linha secundária e vira o número principal em destaque, com a economia da categoria atual logo abaixo.
- Botão "Limpar tudo" ao lado do total quando houver algum corte ativo.

**4. Simulador de entradas (meta de ganhos)**
Clicar numa categoria de entrada abre o mesmo painel em modo "ganhos":
- Slider de aumento de 0% a 100% (e campo de "novo faturamento alvo" para digitar direto).
- Mostra o ganho extra por mês na categoria, o total simulado somando todas as entradas e a projeção em 12 meses.
- Botão "Criar meta de ganhos" pré-preenche o formulário com nome ("Aumentar <categoria>"), alvo = total simulado × 12, prazo de 12 meses e aporte mensal = total simulado.
- Cortes de saída e aumentos de entrada ficam em estados separados, cada um com seu total, sem se misturar.

## Detalhes técnicos

- `src/components/metas/planejamento/FinancialOverview.tsx`: `CategoryList` de entradas passa a aceitar seleção e badge de simulação (mesmo padrão das saídas); rodapé de total simulado adicionado nas duas listas; `OverviewDetailPanel` ganha prop `mode: "expense" | "income"` que troca rótulos, sinal da simulação e o texto do botão de criar meta.
- Alinhamento: `FinancialOverview` recebe refs nos cards de entradas/saídas e reporta o `offsetTop` do card ativo via callback; `Metas.tsx` aplica esse valor como `marginTop` na coluna do painel (com fallback 0 e desativado em telas menores que `lg`, onde o painel segue empilhado).
- `src/pages/Metas.tsx`: estado passa a ser `expenseCuts` e `incomeBoosts`, com `selectedCategory` guardando `{ kind, name }`; grid ajustado para `lg:grid-cols-[230px_minmax(280px,340px)_minmax(0,1fr)]` e `lg:grid-cols-[240px_minmax(0,1fr)]`.
- Reaproveita `simulateSavings`/`deadlineFromMonths` de `src/lib/savingsSimulator.ts`; se precisar de cálculo de aumento, entra como função nova nesse mesmo arquivo com teste unitário.
- Nenhuma alteração fora de `/metas` e seus componentes.
