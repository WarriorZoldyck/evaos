## Ajuste UX — Fluxo de Caixa: subtrair filhos ao expandir

Quando o usuário abre um pai (ex.: ALIMENTAÇÃO), a linha do pai continua mostrando o total agregado — dá a impressão de que "está somando de novo" com os filhos que aparecem abaixo. O cálculo está certo, é só percepção.

### Solução
No componente `CategoryRows` (`src/components/relatorios/DRETable.tsx`), quando um pai está **expandido**:
- Cada célula de período do pai passa a mostrar `totalPai[p] - Σ filhos_diretos[p]` — ou seja, apenas o resíduo (transações lançadas direto no pai, sem subcategoria).
- A coluna "Total" à direita idem.
- Rótulo do pai muda para incluir uma dica sutil quando há resíduo: `ALIMENTAÇÃO · (apenas nesta categoria)` — texto atenuado (`text-muted-foreground`).
- Se o resíduo for zero em todas as células, os valores aparecem como `R$ 0,00` normalmente (não some a linha, para não perder o cabeçalho de grupo).

Quando **fechado**, mantém o comportamento atual (soma total).

O mesmo tratamento vale para qualquer nível (recursivo) — não só ALIMENTAÇÃO.

### Fora do escopo
- Nenhuma mudança no hook `useCashFlowMonthly` (dados continuam iguais).
- Não mexer no DRE — apenas Fluxo de Caixa, se possível localizar via prop; caso `DRETable` seja compartilhado com `DRE.tsx`, adicionar prop opcional `subtractOnExpand?: boolean` (default `false`) e ligar `true` só em `FluxoDeCaixa.tsx`.
