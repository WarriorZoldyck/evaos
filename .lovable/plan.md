## Diagnóstico

Em `src/hooks/useTransactions.ts` (linha 325 e 542-549), a paginação server-side de 20 lançamentos por página só é desativada (modo *exhaustive*) em dois casos:

- Filtro de status = "Pendente"
- Cartão pai (com filhos) selecionado

Em todos os outros casos — inclusive na aba "Todos" com mês selecionado — o Supabase devolve 20 linhas brutas. Como o agrupamento "Fatura mar/2026" é feito **depois**, em `TransactionTable.splitByCycle`, ele só enxerga as parcelas que caíram na página atual. Resultado: a fatura aparece com "18 lançamentos" na página 1, mais um pedaço na página 2, etc. O total exibido na linha agregada também fica errado.

## Solução

Fazer com que, sempre que houver um intervalo de datas finito ativo (Hoje/Semana/Mês/Ano/mês específico), os dados sejam buscados de forma exaustiva e a paginação seja aplicada **na UI**, sobre os itens já agrupados. Assim cada fatura é sempre uma linha única e completa.

### Mudanças

1. **`src/hooks/useTransactions.ts`**
   - Considerar o intervalo de datas como um sinal de "bounded query". Estender a condição `exhaustiveActive` para incluir qualquer filtro com `dateRange` definido (Hoje, Semana, Mês, Ano, mês específico). Os limites de segurança já existentes (2 anos / 5000 registros) continuam protegendo a query.
   - Garantir que `totalCount` reflete a contagem real do intervalo, não o lote paginado.

2. **`src/pages/Lancamentos.tsx` + `src/components/lancamentos/TransactionTable.tsx`**
   - Quando estamos em modo exaustivo, mover a paginação para o `TransactionTable`: gerar a lista de `renderItems` (grupos de fatura + transações soltas) e paginar essa lista (ex.: 20 itens por página de render), em vez de paginar transações brutas.
   - Atualizar o rodapé de paginação (`147 lançamentos • Página 1 de 8`) para refletir a contagem de itens renderizados quando em modo exaustivo, mantendo o total bruto ("147 lançamentos") como informação contextual.
   - A linha agregada da fatura passa a contar `1` na paginação, eliminando a quebra entre páginas.

3. **Comportamento preservado**
   - Sem filtro de data (Tudo): paginação server-side continua como hoje (caso raro e potencialmente grande).
   - Aba "Pendente" e cartão pai: continuam exaustivos como já são.
   - Performance: respeitamos os limites globais (2 anos / 5000 registros) já implementados em `useTransactions`.

### Resultado esperado

Na aba "Todos" com "Mar 2026" selecionado, a linha "MASTERCARD BLACK • Fatura mar/2026" mostra os 42 lançamentos do ciclo inteiros, com o valor total correto, e a navegação por páginas opera sobre os blocos de fatura e os lançamentos soltos — nunca quebrando uma fatura ao meio.
