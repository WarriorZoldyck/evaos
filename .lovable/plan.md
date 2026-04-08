
## Revisão do comportamento atual

Não, do jeito que está hoje isso não vai funcionar como você espera.

Pelo código atual, o drag and drop só reconhece estes destinos:
- raiz de Receita (`root-revenue`)
- raiz de Despesa (`root-expense`)
- área de filhos já aberta (`children-{id}`)

Isso explica o problema que você viu:
1. Se a pasta de destino não estiver expandida, a área “dentro dela” praticamente não existe.
2. Arrastar “sobre a linha” da categoria não transforma automaticamente em subcategoria.
3. O `handleDragEnd` só troca o `parent_id` pelo `droppableId` de destino; ele não interpreta “soltei em cima desta categoria, então ela vira pai”.
4. Resultado: muitos drops acabam indo para a raiz e a categoria vira principal.

## Objetivo corrigido

Deixar a experiência realmente simples, estilo Google Drive:
- arrastar uma categoria para cima de outra categoria para ela virar filha
- arrastar uma subcategoria para fora para ela virar raiz
- arrastar uma pasta inteira para dentro de outra pasta
- permitir até 3 níveis
- evitar estruturas inválidas, como mover uma pasta para dentro de um próprio filho

## Plano atualizado

### 1. Trocar o modelo de drop para “soltar na categoria”
Hoje o drop válido está no container de filhos. Vou mudar para que a própria linha da categoria tenha zonas claras:

- **Antes da categoria** → reordenar no mesmo nível
- **Em cima/centro da categoria** → tornar filha dessa categoria
- **Depois da categoria** → reordenar abaixo dela

Assim o usuário não precisa “acertar” uma área escondida de filhos.

### 2. Autoexpandir e mostrar alvo visual
Para ficar mais natural:
- ao arrastar sobre uma categoria com hover por alguns ms, ela expande sozinha
- destacar visualmente quando o drop vai significar:
  - “virar subcategoria”
  - “mover para raiz”
  - “reordenar”

Isso elimina a sensação de que o sistema “soltou no lugar errado”.

### 3. Reestruturar a lógica de movimento
Hoje `moveCategory(id, newParentId)` só muda o pai. Vou planejar a lógica para distinguir 2 casos:

- **nesting**: item vira filho de outro item
- **reorder**: item muda de posição no mesmo nível ou em outro nível

Para isso, a estrutura precisa considerar:
- `targetParentId`
- `targetIndex`
- `dropMode` (`inside`, `before`, `after`)

### 4. Persistir ordem visual no banco
Hoje não existe `sort_order` em `categories`, então mesmo que o arraste pareça funcionar, a ordem real não fica controlada com precisão.

Vou incluir:
- coluna `sort_order` em `categories`
- leitura ordenada por `parent_id + sort_order + name`
- atualização de ordem quando o usuário rearranjar itens

Sem isso, o comportamento fica inconsistente.

### 5. Bloqueios de integridade
Adicionar validações que hoje faltam:
- impedir mover categoria para dentro dela mesma
- impedir mover para dentro de qualquer descendente
- impedir ultrapassar 3 níveis
- impedir cruzar tipos inválidos, se a regra for manter Receita e Despesa separadas
- ao mover uma subcategoria, preservar coerência de tipo com o pai

### 6. Melhorar a UI de “pasta”
Para ficar mais no estilo que você descreveu:
- pasta fechada/aberta mais evidente
- indicador de quantidade de itens filhos
- alvo de drop mais largo
- expansão por clique e também por hover durante arraste
- ação “Nova pasta” / “Nova subcategoria” mais visível no topo e dentro dos grupos

### 7. Permitir criar pasta nova de forma mais natural
Além do modal atual, incluir um fluxo mais simples:
- botão “Nova pasta” no topo de Receita e Despesa
- botão “Nova subpasta” no hover de cada categoria
- opcionalmente inline rename logo após criar

### 8. Garantir que isso reflita no DRE
Como você quer usar categorias para montar o DRE:
- manter `dre_section` manual nas categorias
- fazer a árvore respeitar a hierarquia definida pelo usuário
- preparar a leitura para que o DRE possa usar essa organização depois, sem depender só de palavras-chave

## Arquivos que precisariam ser ajustados

| Arquivo | Ajuste |
|---|---|
| `src/pages/Categorias.tsx` | Refazer `handleDragEnd` para interpretar “dentro / antes / depois” e não só raiz vs children |
| `src/components/categorias/CategoryTreeItem.tsx` | Criar zonas de drop na própria linha da categoria, hover expand, feedback visual |
| `src/hooks/useCategories.ts` | Evoluir `moveCategory` para suportar pai + posição + validações contra ciclo |
| `src/components/categorias/CategoryFormModal.tsx` | Refinar criação de pasta/subpasta |
| `supabase/migrations/...` | Adicionar `sort_order` em `categories` |
| `src/integrations/supabase/types.ts` | Atualizar tipagem da nova coluna |

## Resultado esperado

Depois dessa revisão, o comportamento correto será:

```text
Receitas
├─ Consultas
│  ├─ Particular
│  └─ Convênio
└─ Procedimentos

Se eu arrastar "Procedimentos" para cima de "Consultas" e soltar no centro:
→ "Procedimentos" vira subcategoria de "Consultas"

Se eu arrastar "Convênio" para fora e soltar na raiz:
→ "Convênio" vira categoria principal

Se eu arrastar uma pasta pai para dentro de outra:
→ toda a pasta vai junto, mantendo seus filhos
```

## Observação técnica importante

O principal motivo de hoje “não entrar dentro da outra categoria” é estrutural:
- a linha da categoria não é tratada como destino de “virar pai”
- a área de filhos só existe quando expandida
- o sistema atual interpreta muitos drops como “mover para raiz”

Ou seja: não é erro de uso seu; o comportamento atual realmente ainda não está no nível hierárquico que você quer.

## Entrega proposta

Eu seguiria em 3 etapas:
1. corrigir a mecânica de drop para permitir encaixe real em outra categoria
2. persistir ordem com `sort_order`
3. polir a experiência visual para ficar simples e previsível, estilo pastas do Google Drive
