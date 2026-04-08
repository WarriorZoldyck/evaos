

# Plano: Categorias Drag & Drop + MDR no Dashboard

## 3 entregas

### 1. Categorias estilo Google Drive com Drag & Drop

**Problema**: A interface atual é uma árvore estática com botões. O usuário quer reorganizar categorias arrastando, como pastas no Google Drive.

**Solução**: Usar a biblioteca `@hello-pangea/dnd` (fork mantido do react-beautiful-dnd) para permitir:
- Arrastar categorias entre níveis (mover subcategoria de um grupo para outro)
- Arrastar para reordenar dentro do mesmo nível
- Visual de pasta com ícones de pasta aberta/fechada
- Ao soltar, chamar `updateCategory` para atualizar o `parent_id` no banco

**Arquivos afetados**:
| Arquivo | Mudança |
|---------|---------|
| `package.json` | Adicionar `@hello-pangea/dnd` |
| `src/pages/Categorias.tsx` | Envolver a árvore com `DragDropContext`, tratar `onDragEnd` para mover categorias |
| `src/components/categorias/CategoryTreeItem.tsx` | Tornar cada item `Draggable` e cada lista de filhos `Droppable`, visual de arraste |
| `src/hooks/useCategories.ts` | Adicionar função `moveCategory(id, newParentId)` que faz UPDATE de `parent_id` |

**Comportamento do drag & drop**:
- Cada grupo (Receita/Despesa) é uma zona droppable separada
- Subcategorias podem ser arrastadas entre grupos pai do mesmo tipo
- Limite de 3 níveis continua respeitado (não permite soltar em nível 3)
- Feedback visual: linha de inserção ao arrastar, opacidade no item sendo arrastado

### 2. Campo `dre_section` nas categorias (preparo para DRE customizado)

**Problema**: Hoje o DRE classifica categorias por palavras-chave. O usuário quer montar o próprio DRE pela organização das categorias.

**Solução em 2 fases**:
- **Fase 1 (agora)**: Adicionar coluna `dre_section` na tabela `categories` (nullable, text). No `CategoryFormModal`, adicionar um select opcional "Seção do DRE" com as opções: Receita Operacional, Impostos sobre Venda, CMV/CSP, Despesas com Vendas, Despesas Operacionais, Despesas Financeiras, Receita Financeira, Despesas Gerais.
- **Fase 2 (agora)**: No `useDREData.ts`, priorizar o campo `dre_section` da categoria quando existir, usando keywords apenas como fallback.

**Arquivos afetados**:
| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `ALTER TABLE categories ADD COLUMN dre_section text DEFAULT NULL` |
| `src/components/categorias/CategoryFormModal.tsx` | Adicionar select de seção DRE |
| `src/hooks/useCategories.ts` | Incluir `dre_section` nos CRUD |
| `src/hooks/useDREData.ts` | Priorizar `dre_section` explícito sobre heurística de keywords |

### 3. MDR de volta no Dashboard

**Problema**: O dashboard não mostra informações de MDR (taxas de maquininha). O campo `original_amount` e `card_terminal_id` existem nas transações mas não são usados nos cálculos do dashboard.

**Solução**: Adicionar um card de resumo de MDR no dashboard mostrando:
- Total bruto (original_amount) das vendas com maquininha no período
- Total líquido (amount) recebido
- Total de taxas MDR (bruto - líquido)
- % médio de MDR

**Arquivos afetados**:
| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDashboardData.ts` | Calcular totais de MDR a partir de transações que têm `card_terminal_id` e `original_amount` |
| `src/components/dashboard/SummaryCards.tsx` | Adicionar card "Taxas MDR" na linha de previsões ou como card adicional |
| `src/pages/Dashboard.tsx` | Passar dados de MDR para o componente |

**Cálculo**:
```text
totalBruto = soma de original_amount onde card_terminal_id IS NOT NULL e status = 'Pago'
totalLiquido = soma de amount dos mesmos registros
totalMDR = totalBruto - totalLiquido
percentMDR = (totalMDR / totalBruto) * 100
```

## Ordem de execução

1. Migration + `dre_section` no CRUD de categorias
2. Drag & drop na interface de categorias
3. DRE priorizar `dre_section` explícito
4. Card de MDR no dashboard

