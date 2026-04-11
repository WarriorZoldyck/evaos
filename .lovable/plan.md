

## Plano: Projetado sem paginação + Filtro de contexto

### Problemas identificados

1. **Paginação no "Projetado"**: A aba "Projetado" aplica `status: "Pendente"` mas mantém a paginação padrão de 20 itens por página. Para transações pendentes/projetadas, faz mais sentido carregar tudo de uma vez (assim como já acontece para filtro de cartão agrupado), pois o usuário precisa ver o panorama completo das obrigações futuras.

2. **Aparentemente só mostra pessoal**: Preciso verificar se o `companyFilter` está sendo aplicado corretamente ou se o seletor de contexto está em "Pessoal" na sidebar. Pela screenshot, parece que o filtro de empresa está correto (mostra Mastercard Black que pode ser pessoal), mas vou garantir que o filtro de conta reflita o contexto selecionado.

### Alterações

**1. `src/hooks/useTransactions.ts` — Busca exaustiva para "Projetado"**
- Quando `filters.status === "Pendente"`, usar o mesmo padrão de busca em lote já existente para cartões agrupados (linhas 282-320): loop com `.range()` em batches de 1000 até esgotar os dados
- Isso elimina a paginação e mostra todos os lançamentos pendentes de uma vez
- A variável `isGroupedParentCardFilter` será expandida para incluir `filters.status === "Pendente"` como condição alternativa para ativar a busca completa

**2. `src/hooks/useTransactions.ts` — totalPages = 1 para Projetado**
- Na linha 542-544 onde calcula `totalPages`, incluir a condição de status "Pendente" para retornar 1 página (sem paginação visual)

### Detalhes técnicos
- Reutiliza o padrão de "Pagination Override" já implementado para cartões hierárquicos
- Sem migração de banco
- Arquivo único afetado: `src/hooks/useTransactions.ts`

