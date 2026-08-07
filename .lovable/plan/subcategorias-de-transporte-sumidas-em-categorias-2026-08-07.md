# Subcategorias de Transporte "sumidas" em Categorias

## O que está acontecendo

Em Categorias (contexto Pessoal), "Transporte" aparece só com "Estacionamento", mas no Fluxo de Caixa aparecem Combustível, Uber, Manutenção, Seguro, Pedágio etc. Elas não foram apagadas — estão em conflito de contexto.

Verificado no banco (usuário espclin):

- Existem dois grupos raiz "Transporte": um Pessoal (sem empresa) e um vinculado à empresa Clínica.
- As subcategorias (Combustível, Uber, Manutenção, Seguro…) são Pessoais, mas o pai delas aponta para o "Transporte" da empresa.
- A tela de Categorias carrega só as categorias do contexto ativo. Como o pai está em outro contexto, os filhos ficam "órfãos" e a árvore simplesmente não os exibe.
- Isso não é exclusivo de Transporte: há 70 pares pai/filho com contexto divergente, em 7 usuários (mesmo padrão em Alimentação, Roupas, Saúde, Salários, Tarifas…).

O Fluxo de Caixa continua mostrando tudo porque monta a hierarquia sem esse recorte.

## Correção proposta

Duas frentes, para resolver o caso agora e evitar que volte.

### 1. Consertar os dados (migração global)

Para cada par pai/filho com contexto diferente:

- Se existir um grupo de mesmo nome no contexto do filho (caso "Transporte"), reapontar o filho para esse grupo do próprio contexto.
- Se não existir, alinhar o filho ao contexto do pai (o filho passa a pertencer à mesma empresa/Pessoal do pai), preservando nome, tipo e lançamentos.

Nada é excluído; só o vínculo pai/contexto é ajustado. Backup da tabela `categories` antes de rodar.

### 2. Impedir que aconteça de novo

- Ao criar/mover subcategoria, gravar sempre o `company_id` do pai, em vez do contexto selecionado no momento.
- Bloquear mover uma categoria para um pai de outro contexto.
- Na tela de Categorias, exibir categorias sem pai visível em um bloco "Sem grupo" no fim da coluna, para nunca mais desaparecerem silenciosamente da tela.

## Detalhes técnicos

- Migração SQL sobre `public.categories` com backup em tabela `backup_categorias_contexto_<data>`; resolução por `lower(trim(name))` dentro do mesmo `user_id` + contexto do filho.
- `src/hooks/useCategories.ts`: `createCategory` e `moveCategory` herdam `company_id` do pai; validação de contexto no move.
- `src/pages/Categorias.tsx`: seção "Sem grupo" com as categorias cujo `parent_id` não está no conjunto carregado.
- Validação: reconferir Transporte (Pessoal) na tela e comparar a árvore com o Fluxo de Caixa.
