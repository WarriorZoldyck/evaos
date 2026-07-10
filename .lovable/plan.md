## Clareza na conciliação do cartão + sugestão completa de categoria/sub/sub-sub

Foco em 3 melhorias, todas na tela de conciliação do extrato de cartão (`ReconcileStep.tsx` + `useCategorySuggestions.ts` + edge `suggest-categories`). Nada muda em conta débito, cria/edita transação ou matching.

### 1. Aviso claro sobre data de pagamento na seção "Provável — confirmar"

**Onde:** `ReconcileStep.tsx`, bloco `suggestedRows` (linhas ~634-722), no alerta amarelo (linha 649).

**Mudança:** trocar o texto do Alert para deixar explícito que **valor bate mas a data pode ser de outra fatura**, e que o usuário precisa conferir se a compra do extrato corresponde ao mesmo mês da compra do sistema. Texto proposto:

> **Atenção à data de pagamento.** Achamos um lançamento no sistema com valor igual e data próxima, mas descrição diferente. Confira se as duas linhas são da **mesma fatura** — pode ser uma compra parecida de outro mês. Se for a mesma compra, clique em **"É o mesmo"**; se for uma compra nova (mesmo que parecida), clique em **"Criar novo"**.

Além disso, quando `daysOff` cruzar o limite do mês (ex.: linha do extrato 01/05 vs. candidato 09/05 e vice-versa), mostrar um badge extra `⚠ mês diferente` ao lado do `+Nd` que já existe.

### 2. Botão explícito "Criar novo" ao lado de "É o mesmo" / "Ignorar"

**Onde:** mesma seção, botões nas linhas ~697-717.

**Hoje:** só existem "É o mesmo" e "Ignorar". "Criar novo" é o estado default implícito — invisível.

**Mudança:** adicionar terceiro botão `Criar novo` (ícone `Plus`, cor sky/primária) que:

- Chama `onActionChange(i, "criar")` explicitamente.
- Limpa `targetChange(i, null)` (garante que não vincule).
- Move visualmente a linha da seção "Provável" para "Só no extrato — o que fazer?", onde os seletores de categoria aparecem e o botão "Concluir/Importar" do rodapé já contabiliza a criação (a lógica de conclusão já responde a `counts.criar` — nenhuma mudança em `handleImport`).

Efeito prático: o usuário clica "Criar novo" → linha vai pro bloco de novas → categoria auto-sugerida aparece → botão do rodapé "Importar N lançamentos" já reflete a nova linha, permitindo concluir imediatamente.

### 3. Trazer categoria + subcategoria + sub-sub na sugestão automática

**Diagnóstico:** o `useCategorySuggestions` só sugere `category` (nível 1). O import salva `subcategory` e `subcategory2` corretamente (`ImportStatementModal.tsx` linhas 905-919), mas eles nunca são pré-preenchidos porque o hook não os devolve.

**Mudança em `useCategorySuggestions.ts`:**

- Selecionar também `subcategory` e `subcategory2` no histórico (`select("description, category, subcategory, subcategory2, type")`).
- Ampliar `SuggestionSource` para incluir `subcategory?: string` e `subcategory2?: string`.
- No agrupamento por votos, contar a **tripla** `(category, subcategory, subcategory2)`. Quando houver empate, escolher a tripla com mais votos; se subcategoria/sub-sub ficarem em minoria, cair para nível 2 e depois nível 1 (nunca inventar um nível se o histórico não apoiar).
- Validar que os nomes existem na árvore atual de categorias antes de aplicar (evita sugerir sub/sub-sub que o usuário renomeou/apagou).

**Mudança em `ReconcileStep.tsx` (efeito colateral):**

- Quando aplicar sugestão inicial no `rowCategories[i]`, também aplicar `subcategory` e `subcategory2` do `SuggestionSource`.
- O indicador visual "baseado no histórico / sugerido pela IA" (linhas 890-900) já cobre; nenhuma UI nova.

**Edge function `suggest-categories`:** manter apenas nível 1 por enquanto (LLM tem que aprender árvore inteira; risco/custo alto). A cobertura efetiva de sub/sub-sub vem do histórico, que é onde o usuário já classificou consistentemente. **Fora de escopo agora:** ensinar a IA a sugerir sub-níveis.

### Fora de escopo (não mexo agora)

- Separação cartão × débito em componentes distintos (já discutido, adiamos).
- Alterar `handleImport`, criação de lançamentos ou matching.
- Mudar a seção "Só no sistema" (orphans).
- Sugestão de sub-categorias via IA (só via histórico por ora).

### Verificação

1. Rebuild + typecheck.
2. Simular no preview: extrato com uma compra "Provável" — conferir texto do alerta, badge de mês diferente e comportamento do botão "Criar novo".
3. Extrato com merchant recorrente (ex.: "Uber") já categorizado no histórico com sub e sub-sub — conferir que os 3 níveis vêm preenchidos ao mudar para "criar novo".
