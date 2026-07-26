## Testes para a correção de resolução de categorias

Vou adicionar cobertura automatizada em torno do novo utilitário `src/lib/categoryChain.ts` — que é onde vive a lógica de resolução por ID — e um teste de integração leve no `CategoryCascadeSelect` para garantir que o comportamento visual observado pelo usuário está correto.

### 1. Setup de teste (se necessário)
- Verificar se `vitest`, `@testing-library/react`, `jsdom` e `@testing-library/jest-dom` já estão instalados. Se não, instalar as devDependencies e criar `vitest.config.ts` + `src/test/setup.ts` conforme o guia padrão do projeto.

### 2. Testes unitários — `src/lib/categoryChain.test.ts`
Cobrir os cenários que motivaram o bug:
- Índice retorna `byParent` e `byName` corretos para árvore com 3 níveis.
- `resolveChain` escolhe a raiz certa quando **duas raízes compartilham o mesmo nome**, priorizando aquela cujo filho bate com `subcategory`.
- `resolveChain` funciona com apenas `category` preenchido.
- `resolveChain` respeita acentos/caixa (normalização) — "Alimentação" vs "alimentacao".
- `resolveChain` retorna `null`s quando nada bate.
- `childrenOfId` devolve filhos diretos de um pai e lista vazia para pai inexistente.

### 3. Teste de componente — `src/components/lancamentos/import/CategoryCascadeSelect.test.tsx`
- Montar o componente com uma árvore contendo duas raízes de mesmo nome mas subárvores diferentes.
- Selecionar a raiz e abrir o dropdown de subcategoria; confirmar que aparecem os filhos corretos da raiz escolhida (não só os do primeiro match por nome).
- Confirmar que trocar o valor da linha (rerender com novo `value`) reexibe corretamente as opções — simula o "trocar entre linhas" que o usuário reportou.

### 4. Execução
- Rodar `vitest run` via o executor de testes do harness.
- Rodar `tsgo` (typecheck) para garantir que nenhuma tipagem quebrou.

### 5. Verificação manual assistida (opcional, só se algum teste falhar de forma inconclusiva)
- Script Playwright abrindo `/lancamentos/importar-extrato` para conferir visualmente o cascade, apenas se os testes automatizados não cobrirem uma regressão observada.

### Arquivos criados
- `src/lib/categoryChain.test.ts`
- `src/components/lancamentos/import/CategoryCascadeSelect.test.tsx`
- (se ausentes) `vitest.config.ts`, `src/test/setup.ts`

Nenhum código de produção será alterado neste passo — se algum teste falhar, aí sim ajusto a lógica correspondente.
