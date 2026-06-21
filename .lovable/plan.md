## Revisão completa do modal de Importação / Conciliação

Cobrindo todos os pontos: botão "Manter" + tooltip explicativo do "X", verificar/eliminar duplicação aparente, textos de ajuda em cada bloco, auto-propagação de categoria para linhas iguais, e categorização hierárquica (categoria → subcategoria → sub-subcategoria).

---

### 1. Ações na seção "Compras já lançadas no cartão"

Hoje só existe **X** (que cria uma cópia nova) e o usuário não entende. Manter o **X** como ação avançada e adicionar a ação principal "Manter existente":

```
[ Trocar ]  [ ✓ Manter existente ]  [ ✕ ]
```

- **✓ Manter existente** (novo, ação padrão sugerida, verde): ação = `ignorar` da linha do extrato. O lançamento que já existe no sistema **permanece intacto**, e a linha do extrato é descartada (vai para "Ignorados", restaurável). Sem duplicata.
- **✕** (mantido como hoje): ação = `criar`. Desfaz o vínculo e importa a linha do extrato como **um lançamento novo, além do que já existe** — útil só se o usuário identificar que são compras diferentes com mesmo valor/data. Adicionar `<Tooltip>` no hover/foco com texto claro: *"Desfaz o vínculo e cria um lançamento NOVO a partir da linha do extrato. O lançamento que já existe no sistema continua existindo — pode gerar duplicata. Use só se for realmente uma segunda compra."*
- Adicionar um pequeno bloco informativo (Alert/box discreto) acima da lista da seção explicando: *"Encontramos esses lançamentos que você já tinha registrado. Por padrão eles serão **vinculados** (status mantido). Use ✓ Manter existente para descartar a linha do extrato sem criar nada novo, ou ✕ para forçar a criação de um lançamento adicional."*

### 2. Box explicativo em cada seção

Adicionar um `<Alert>` curto, com ícone, no topo de cada uma das três seções:

- **Compras já lançadas no cartão** — *"Linhas do extrato que casam com lançamentos já existentes. Vínculo padrão = não duplica nada."*
- **Criar no sistema** — *"Linhas novas do extrato que não tinham correspondente. Serão importadas como projetadas até a fatura ser paga. Defina categoria (e subcategorias) antes de importar."*
- **Ignorados** — *"Linhas descartadas. Não entram na importação. Clique em Restaurar para trazer de volta."*

### 3. Verificação de duplicação entre seções

Confirmação técnica: hoje cada linha (`i`) só aparece em **uma** seção, porque `matchedRows`/`newRows`/`ignoredRows` são partições disjuntas baseadas em `matchActions[i]`. A sensação de duplicata vem de:

a) **Multi-cartão:** o hook `useImportMatching` faz `setMatches(result)` a cada chamada por grupo, sobrescrevendo o estado e fazendo linhas de cartões anteriores caírem em "Criar no sistema". Corrigir: a função externa retornará todos os matches consolidados e o modal fará um único `setMatches` com o merge dos grupos (acumulando em vez de sobrescrever).
b) **Dedup visual de extrato:** dentro de "Criar no sistema", agrupar linhas idênticas (mesma descrição normalizada + valor + tipo) com um contador `×N` opcional — sem fundir, mas alertando que são repetidas. Permite revisão rápida.

### 4. Auto-propagação de categoria para linhas iguais

Quando o usuário escolher categoria (ou sub/sub-sub) em uma linha de "Criar no sistema":

- Identificar todas as outras linhas em "Criar no sistema" cuja **descrição normalizada** (lowercase, sem acento, sem múltiplos espaços) **e** valor absoluto sejam iguais e que ainda **não tenham categoria definida manualmente pelo usuário** (só sugestão da IA/histórico ou vazio).
- Aplicar a mesma `category` + `subcategory` + `subcategory2` nelas.
- Mostrar um toast discreto: *"Categoria aplicada a mais N lançamentos iguais. Desfazer"* — clicando em Desfazer, volta as N linhas ao estado anterior.
- Marcar internamente cada linha com `categoryTouched` para distinguir "sugestão automática" de "escolha manual" (sugestão pode ser sobrescrita pela propagação; escolha manual nunca é).

### 5. Categorização hierárquica (sub e sub-sub)

Substituir o `Select` único da coluna "Categoria sugerida" por **três selects encadeados** (mesma lógica de `TransactionFormModal`):

1. **Categoria** — itens com `parent_id === null`.
2. **Subcategoria** — filhas da categoria selecionada (oculto se não houver).
3. **Sub-subcategoria** — filhas da subcategoria selecionada (oculto se não houver).

- A sugestão da IA/histórico hoje retorna um nome único. No client, ao receber a sugestão, resolvemos o nome contra todos os níveis e preenchemos os ancestrais automaticamente (busca por nome normalizado em qualquer `parent_id`). Mantém o selo "baseado no histórico" / "sugerido pela IA".
- Layout compacto na coluna (3 selects empilhados, `h-7 text-xs`), com placeholders "Categoria", "Subcategoria", "Sub-sub" para caber sem quebrar a tabela.
- Persistir os 3 campos no insert (`category`, `subcategory`, `subcategory2`).

### 6. Estado e tipos

- `rowCategories` em `ImportStatementModal` passa a ser `Record<number, { category: string; subcategory?: string; subcategory2?: string; touched?: boolean }>`.
- `onCategoryChange(i, payload)` em `ReconcileStep` recebe objeto, não string.
- `handleImport` envia os três campos no `insert`.

### Arquivos afetados

- `src/components/lancamentos/import/ReconcileStep.tsx`
  - Novo botão **Manter existente** + Tooltip explicativo do **X**.
  - `<Alert>` em cada seção.
  - 3 selects encadeados de categoria.
  - Agrupamento visual `×N` para linhas idênticas em "Criar no sistema".
- `src/components/lancamentos/ImportStatementModal.tsx`
  - `rowCategories` com 3 níveis + flag `touched`.
  - Propagação de categoria para linhas iguais + toast com "Desfazer".
  - Merge de `matches` por grupo de cartão (sem sobrescrever).
  - Insert grava `subcategory` e `subcategory2`.
- `src/hooks/useImportMatching.ts`
  - Suportar merge (aceitar um `mergeWith` ou apenas devolver e deixar o modal compor) para não sobrescrever entre grupos de cartão.

Sem mudanças de banco, RLS, edge functions ou na função `suggest-categories`.
