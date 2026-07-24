## Objetivo
Cruzamento 100% baseado no histórico do próprio usuário — nunca misturar dados entre usuários — e garantir que a categoria correta apareça sempre que existir histórico compatível.

## Garantia de isolamento por usuário
- Toda consulta continua com `.eq("user_id", effectiveUserId)` nas tabelas `public.transactions` e `public.ai_pending_transactions`.
- RLS já impede vazamento entre usuários; mantemos o filtro explícito como defesa dupla.
- Nada de cache global entre sessões: as amostras são carregadas por importação, a partir do user_id efetivo.

## Correções no motor de sugestão (`useCategorySuggestions.ts`)

1. **Não descartar histórico só porque a categoria não está no mapa local**
   - Hoje `toName()` retorna `null` quando a categoria histórica não bate exatamente com a lista carregada no modal → a amostra é descartada silenciosamente.
   - Passar a aceitar o nome do histórico como está (texto), desde que não seja vazio nem "Sem Categoria/Sem categoria".
   - Depois, na hora de aplicar na linha, se o nome não existir na árvore de categorias do contexto atual, criar/mapear via `resolveCategoryPath` (fallback já existente) ou deixar apenas o nível que existir.

2. **Ignorar amostras não categorizadas em qualquer nível**
   - Filtrar `category` nulo/`""`/`"sem categoria"` (case-insensitive, sem acento).
   - Mesmo tratamento para `subcategory` e `subcategory2` — se vier "Sem categoria", tratar como ausente, não como nível válido.
   - Isso evita que uma amostra antiga sem categoria "vença" outra correta.

3. **Prioridade absoluta para descrição idêntica normalizada**
   - Layer 0 (match exato pós-normalização) deve preferir a amostra mais **profunda e recente** categorizada.
   - Se houver múltiplas amostras iguais, escolher a de maior profundidade (subcategory2 > subcategory > category) e, em empate, a mais recente.
   - Exemplo validado no banco: `L E M ESCOVA E BELEZA` → **Beleza > Salão** (existem 5 amostras assim e 4 como "Sem Categoria"; as "Sem Categoria" devem ser ignoradas).

4. **Fallback preserva profundidade parcial**
   - Se o histórico traz apenas `Saúde` (sem subcategoria), aplicar `Saúde` e deixar subcategoria em branco — não inventar via IA.
   - Se traz `Saúde > Farmácias`, aplicar os dois níveis.

5. **IA continua desligada**
   - Linhas sem histórico ficam "Sem categoria" para o usuário ajustar. Nada de "sugerido pela IA".

## Ajuste no modal (`ImportStatementModal.tsx`)
- Ao aplicar a sugestão em `rowCategories`, se `resolveCategoryPath` não encontrar o nome exato na árvore local, tentar casar por normalização (lowercase + sem acento) antes de desistir. Assim uma categoria histórica com capitalização diferente (`transporte` vs `Transporte`) ainda preenche a linha.

## Validação (após implementar)
1. Rodar a importação novamente para `espclin@hotmail.com` e conferir:
   - `L E M ESCOVA E BELEZA` → **Beleza > Salão**
   - `DROGASIL …` → **Saúde > Farmácias** (não só "Saúde")
   - Postos → categoria histórica correspondente
2. Consultar o banco antes/depois para provar que:
   - Nenhuma consulta cruza `user_id` de outros usuários.
   - As sugestões refletem exatamente o que existe no histórico do próprio usuário.

## Fora de escopo
- Nenhuma mudança de RLS, schema ou dados históricos.
- Nenhum retorno da sugestão por IA neste momento.