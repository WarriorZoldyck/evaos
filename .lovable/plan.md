

## Correcao: Categorias mostrando ID em vez do nome

### Problema
Ao criar uma subcategoria ou sub-subcategoria inline no formulario de lancamentos (via "Criar nova"), o sistema salva o UUID da categoria no campo do formulario, mas a lista de categorias ainda nao foi atualizada -- causando dois problemas:

1. **No Select do formulario**: Apos criar, o dropdown mostra o UUID em vez do nome, porque o `fetchFormCategories()` e assincrono e o React ainda nao re-renderizou com a lista atualizada
2. **Na tabela de lancamentos**: Depois de salvar a transacao, a tabela mostra o UUID porque o `useTransactions` carrega categorias apenas uma vez (no mount) e nao recarrega apos criar novas

### Correcao

**Arquivo 1: `src/components/lancamentos/CategorySelectWithCreate.tsx`**

O componente cria a categoria e chama `onCategoryCreated(data.id)`. O pai faz `await onCategoryCreated()` (fetchFormCategories) e depois `field.onChange(newId)`. Porem o estado ainda nao atualizou quando o Select tenta renderizar o valor.

Correcao: O proprio `CategorySelectWithCreate` deve adicionar a nova categoria localmente na lista de opcoes ate que o pai atualize. Apos criar com sucesso, inserir o novo item (`{ id: data.id, name: newName }`) na lista local `categories` antes de chamar o callback. Isso elimina a janela onde o Select nao encontra o item.

**Arquivo 2: `src/hooks/useTransactions.ts`**

Extrair `fetchAux` para fora do `useEffect` como funcao standalone (similar ao `fetchTransactions`). Expor uma funcao `refetchAux` ou `refetchCategories`. Chamar `fetchAux` dentro dos callbacks `createTransaction`, `createMultipleTransactions` e `updateTransaction` alem do `fetchTransactions` ja existente, para que a tabela tenha as categorias atualizadas.

**Arquivo 3: `src/pages/Lancamentos.tsx`**

Chamar `refetchCategories` (ou garantir que `refetchAux` e chamado) apos o modal de transacao fechar com sucesso, para que a tabela renderize nomes em vez de UUIDs.

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/lancamentos/CategorySelectWithCreate.tsx` | Alterar: adicionar nova categoria localmente apos criar |
| `src/hooks/useTransactions.ts` | Alterar: expor refetchCategories, chamar apos save/update |
| `src/pages/Lancamentos.tsx` | Alterar: chamar refetchCategories ao fechar modal |
