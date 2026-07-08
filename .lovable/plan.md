## Plano de correção

Vou corrigir a conciliação para nunca mostrar UUID de categoria/subcategoria para o usuário.

### 1. Resolver UUID para nome na tela de conciliação
- Em `ReconcileStep`, criar um resolvedor usando a lista `categories` já recebida pela tela.
- Se `category`, `subcategory` ou `subcategory2` vier como UUID, mostrar o `name` correspondente.
- Se já vier como nome, manter o nome.

### 2. Corrigir lançamentos já existentes exibidos como pares/orfãos
- Aplicar o resolvedor em:
  - lançamentos conciliados em “Igual — pode conciliar”;
  - “Provável — confirmar”;
  - “Só no sistema”.
- Assim registros antigos que foram salvos com UUID aparecem com nomes legíveis.

### 3. Evitar salvar UUID em novas importações
- Antes de montar `TransactionInsert` no import, normalizar `rowCategories` para nomes.
- Se alguma categoria selecionada/sugerida vier como ID, converter para nome antes de gravar em `transactions.category`, `subcategory`, `subcategory2`.

### 4. Preservar hierarquia
- Para categoria/subcategoria/sub-subcategoria, manter a cadeia correta pelo `parent_id` quando possível.
- Não alterar dados antigos no banco agora; só corrigir exibição e novos inserts neste fluxo.

Resultado esperado: a tela deixa de mostrar IDs como `5d8a...` e passa a mostrar nomes como `Alimentação › Supermercado`, inclusive em lançamentos já existentes usados na conciliação.