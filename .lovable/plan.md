Vou corrigir a quebra visual que apareceu para alguns usuários sem desfazer a barra fixa.

Plano:
1. Ajustar o cabeçalho global de Lançamentos para não “espremer” os controles quando a tela for menor:
   - busca fica perto do botão de menu, mas com largura responsiva;
   - controles centrais podem ocupar menos espaço sem quebrar de forma irregular;
   - textos longos dos botões podem ocultar em larguras menores, mantendo ícones e ações.
2. Reorganizar a linha fixa de filtros para manter o visual correto em diferentes larguras:
   - voltar a usar largura responsiva nos selects em telas menores;
   - permitir que os filtros quebrem linha de forma limpa, sem ficar sobrepostos ou cortados;
   - preservar o fundo opaco/sticky para não aparecer lançamento atrás.
3. Ajustar alturas e espaçamentos dos filtros para ficarem consistentes com a imagem de referência.
4. Validar no viewport atual e em uma largura intermediária menor para garantir que os menus não fiquem quebrados.

Arquivos previstos:
- `src/components/layout/AppLayout.tsx`
- `src/pages/Lancamentos.tsx`
- `src/components/lancamentos/TransactionFilters.tsx`

Fora do escopo: lógica de filtros, dados, tabela, importação/exportação e Supabase.