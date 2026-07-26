## Virtualização do seletor de categorias

O `CategoryCascadeSelect` hoje mapeia todos os itens de cada nível dentro de `CommandGroup` (`roots.map`, `subs.map`, `sub2s.map`). Contas com muitas categorias/subcategorias — comum em empresas com plano de contas grande — renderizam centenas de `CommandItem`, deixando o popover lento para abrir, filtrar e rolar.

### Solução

Introduzir virtualização com `@tanstack/react-virtual` (biblioteca leve, ~3 kB, alinhada ao stack Radix/cmdk) nas três listas do cascade. Manter `CommandInput` para acessibilidade e digitação, mas assumir o filtro em estado controlado para poder repassar apenas os itens já filtrados ao virtualizador.

### Mudanças

1. **Dependência**
   - `bun add @tanstack/react-virtual`.

2. **Novo componente utilitário** `src/components/lancamentos/import/VirtualCommandList.tsx`
   - Props: `items: CategoryFlat[]`, `search: string`, `selectedName: string`, `onPick: (name) => void`.
   - Filtro acento-insensível compartilhado (reaproveitar `normalize`).
   - `useVirtualizer` com `estimateSize = 28`, `overscan = 8`, container scrollável de `max-h-[280px]`.
   - Renderiza `CommandItem` posicionado absolutamente para cada índice virtual.
   - Ativa a virtualização somente quando `items.length > 50` (abaixo disso, renderiza normal — evita overhead).

3. **`CategoryCascadeSelect.tsx`**
   - Adicionar `useState` para o texto de busca de cada nível (`catSearch`, `subSearch`, `sub2Search`).
   - Trocar `<Command filter={commandFilter}>` por `<Command shouldFilter={false}>` — o filtro passa a ser feito no `VirtualCommandList` para bater com os itens virtualizados.
   - Ligar `CommandInput` como controlado (`value`/`onValueChange`).
   - Substituir cada `CommandGroup` de opções pelo `VirtualCommandList`. Os itens fixos ("— limpar —" e "Nova …") continuam fora, em `CommandGroup` normal.
   - Manter `CommandEmpty` reativo baseado no comprimento da lista filtrada.

4. **Preservar comportamentos existentes**
   - Índice por ID (`buildCategoryIndex` + `resolveChain`) permanece intacto.
   - Criação inline (dialog `Nova …`) e limpeza continuam funcionando.
   - `strictType` continua respeitado — a lista já chega filtrada por tipo.
   - Fechamento por clique em item continua via `onPick` → `pickCat/pickSub/pickSub2`.

5. **Testes**
   - Estender `src/components/lancamentos/import/CategoryCascadeSelect.test.tsx`:
     - Renderizar com >200 categorias sob a mesma raiz e conferir que apenas um subconjunto de nós é montado (via `screen.getAllByRole("option").length`).
     - Digitar no `CommandInput` e conferir que apenas os itens que batem com o termo aparecem.
   - Manter os testes existentes (colisão por nome, troca de linha).
   - Rodar `bunx vitest run` para confirmar tudo verde.

### Fora do escopo

- Não alterar `ReconcileStep` — ele já consome o cascade e se beneficia automaticamente.
- Não mudar a API pública do componente.
- Não introduzir memoização adicional além do necessário para a virtualização.

### Arquivos tocados
- `src/components/lancamentos/import/CategoryCascadeSelect.tsx`
- `src/components/lancamentos/import/VirtualCommandList.tsx` (novo)
- `src/components/lancamentos/import/CategoryCascadeSelect.test.tsx`
- `package.json` (+ `@tanstack/react-virtual`)
