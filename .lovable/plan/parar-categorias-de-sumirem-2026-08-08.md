# Parar categorias de “sumirem”

## Diagnóstico confirmado

A auditoria encontrou três mecanismos reais de desaparecimento:

- Há **15 categorias de um usuário vinculadas à empresa de outro usuário**. Duas delas também apontam para um pai de outro proprietário; outras três ficaram com `parent_id` de pais que já não existem. Como as telas filtram por proprietário e contexto, esses registros deixam de aparecer na árvore ou nos seletores.
- O banco atualmente aceita esses vínculos inválidos: `categories.company_id` e `categories.parent_id` têm chaves estrangeiras simples, mas não garantem que categoria, pai e empresa pertençam ao mesmo proprietário. Também não há trigger de integridade na tabela.
- A exclusão de uma empresa usa cascata no banco e a interface executa a remoção imediatamente, sem confirmação contextual. Isso pode apagar todas as categorias daquela empresa e seus descendentes. A exclusão de uma categoria também pode ser feita pela EVA/WhatsApp; o banco usa cascata para filhos, então uma checagem desatualizada ou contornada pode remover a árvore inteira.

A correção anterior de herança de contexto está presente no fluxo principal da tela, mas não protege todos os escritores nem o banco. Os backups auditados continuam íntegros; não há item daquele backup ausente hoje.

## Implementação

### 1. Restaurar os registros afetados sem excluir dados

- Criar um backup datado dos registros afetados antes da correção.
- Reatribuir as 15 categorias ao proprietário correto da empresa quando o vínculo e a árvore mostrarem que pertencem àquele workspace; preservar IDs para não romper lançamentos.
- Para os três pais inexistentes, religar ao pai equivalente do mesmo usuário/contexto quando houver correspondência inequívoca; caso contrário, promover a categoria para a raiz, para que volte a ficar visível.
- Consolidar os dois pares duplicados já identificados somente quando nome, contexto e pai forem exatamente iguais, migrando referências antes de remover a cópia.

### 2. Transformar integridade em regra do banco

- Adicionar uma validação em `categories` que, em toda criação ou alteração:
  - confirme que `company_id` pertence ao mesmo `user_id` da categoria;
  - confirme que o pai pertence ao mesmo `user_id`;
  - faça a subcategoria herdar o `company_id` do pai;
  - bloqueie ciclos e profundidade acima de três níveis.
- Trocar o efeito destrutivo de exclusão do pai por bloqueio explícito: uma categoria com filhos não poderá ser apagada até que eles sejam movidos ou removidos conscientemente.
- Impedir a exclusão de empresa enquanto houver categorias ou outros dados financeiros vinculados, em vez de apagá-los em cascata.

### 3. Fechar todos os caminhos de escrita

- Ajustar criação e movimentação pela EVA no app e pelo WhatsApp para resolver o pai por ID, herdar o contexto dele e tratar claramente erros de integridade.
- Manter a proteção já existente na tela de Categorias e reforçar o fluxo de criação rápida usado em lançamentos/importação.
- Exigir confirmação explícita para excluir empresa ou categoria e informar quantos vínculos impedem a ação.

### 4. Garantir visibilidade e recuperação

- Nos seletores hierárquicos, incluir uma área “Sem grupo” para qualquer registro legado cujo pai não esteja carregado, evitando desaparecimento silencioso.
- Registrar erro visível quando uma consulta de categorias falhar; não substituir a lista anterior por vazio.
- Incluir teste de regressão para árvore órfã, troca de contexto, criação por pai e tentativa de vínculo entre proprietários.

## Validação

- Reexecutar a auditoria global e exigir zero categorias com empresa ou pai de outro proprietário, zero pais inexistentes e zero duplicatas exatas.
- Validar Pessoal e Empresa nas telas Categorias, Novo lançamento, Importação e filtros.
- Testar criação/movimentação pela tela, EVA in-app e WhatsApp.
- Tentar excluir pai com filhos e empresa com dados, confirmando que nada é apagado em cascata.
- Executar o linter do Supabase e os testes direcionados do frontend/edge functions.

## Observação técnica

A correção será dividida em uma migração estrutural (triggers, constraints e comportamento das chaves), uma alteração de dados separada para restauração e ajustes nos escritores frontend/edge functions. Nenhuma categoria ou lançamento será apagado sem correspondência comprovada e backup prévio.