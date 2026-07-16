Vou ajustar apenas a barra fixa da página de Lançamentos para impedir que os itens da lista apareçam por trás dos filtros.

Plano:
1. Tornar a faixa dos filtros realmente opaca e contínua, usando fundo de `card/background` sem transparência e sombra/borda inferior para separar da lista.
2. Corrigir o ponto de fixação da barra: ela ficará imediatamente abaixo do cabeçalho global, sem deixar a primeira linha da lista passar atrás.
3. Remover o espaçamento vertical que hoje cria uma “janela” entre filtros e tabela durante a rolagem, fazendo a área sticky cobrir toda a largura útil.
4. Dar `z-index` maior à barra de filtros e menor/normal ao conteúdo da tabela, mantendo menus/selects funcionando por cima quando abertos.
5. Revisar a distribuição dos filtros da segunda linha para continuar igual à referência: botões de tipo/conciliação à esquerda e selects ocupando o restante, sem sobreposição.

Arquivos previstos:
- `src/pages/Lancamentos.tsx`
- `src/components/lancamentos/TransactionFilters.tsx`, somente se for necessário ajustar espaçamento/wrap da linha de filtros.