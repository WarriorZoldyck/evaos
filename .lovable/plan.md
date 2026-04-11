

## Plano: Página de Centros de Custos + Drag-and-Drop de Categorias

### Resumo
Criar uma nova página "Centros de Custos" que exibe as seções do DRE como pastas visuais (mesmo layout da tela de Categorias), onde o usuário pode arrastar categorias para dentro de cada centro de custo. Isso atualiza o campo `dre_section` da categoria, que o DRE contábil já usa para classificar as linhas. MDR será opcional via toggle.

### Como funciona

```text
┌─────────────────────────────────────────────┐
│  Centros de Custos                          │
│  ─────────────────                          │
│  [toggle MDR ativado/desativado]            │
│                                             │
│  📁 (+) Receita Operacional                 │
│     └─ Consultas (arrastada aqui)           │
│     └─ Procedimentos                        │
│                                             │
│  📁 (-) Impostos sobre Venda                │
│     └─ Simples Nacional                     │
│                                             │
│  📁 (-) CMV / CSP                           │
│     └─ Materiais                            │
│                                             │
│  📁 (-) Despesas Operacionais               │
│     └─ Aluguel                              │
│     └─ Energia                              │
│                                             │
│  📁 (-) Despesas Financeiras                │
│                                             │
│  📁 (+) Receita Financeira                  │
│                                             │
│  📁 (-) Despesas com Vendas                 │
│                                             │
│  📁 (-) Despesas Gerais                     │
│                                             │
│  📁 (-) Taxas MDR  ← (só aparece se toggle) │
│                                             │
│  ── Categorias sem centro de custo ──       │
│     └─ Categoria X (arrastar para cima)     │
│     └─ Categoria Y                          │
└─────────────────────────────────────────────┘
```

### Etapas de implementação

1. **Nova página `src/pages/CentrosDeCustos.tsx`**
   - Exibe as seções DRE como "pastas" fixas (não editáveis), cada uma expansível
   - Dentro de cada pasta, lista as categorias cujo `dre_section` corresponde àquela seção
   - Abaixo, uma seção "Sem centro de custo" com categorias que têm `dre_section = null`
   - Drag-and-drop: arrastar uma categoria para dentro de um centro de custo atualiza `dre_section` no banco
   - Toggle para MDR: quando desativado, esconde a pasta "Taxas MDR" e remove o `dre_section` das categorias ali

2. **Componente `src/components/centros-de-custo/CostCenterTreeItem.tsx`**
   - Reutiliza o visual do `CategoryTreeItem` mas simplificado (sem editar/excluir pastas-mãe, pois são fixas)
   - Categorias dentro são arrastáveis para fora ou entre centros

3. **Sidebar: adicionar link "Centros de Custos"** abaixo de "Categorias" em `AppSidebar.tsx`

4. **Rota em `App.tsx`**: `/centros-de-custos` apontando para a nova página

5. **Hook `useCostCenters`** (ou reutilizar `useCategories`):
   - Busca todas as categorias do usuário/empresa
   - Agrupa por `dre_section`
   - Função para atualizar `dre_section` de uma categoria (update simples no banco)

6. **Toggle MDR**: estado salvo no `profiles.transaction_form_fields` (campo JSON já existente) como `mdr_cost_center_enabled`. Quando desativado, esconde a pasta MDR da página.

### Detalhes técnicos

- **Sem migração de banco**: o campo `dre_section` já existe na tabela `categories` e já é usado pelo DRE contábil
- **DRE sections fixas**: `receita_operacional`, `impostos_venda`, `cmv_csp`, `despesas_vendas`, `despesas_operacionais`, `despesas_financeiras`, `receita_financeira`, `despesas_gerais` + novo `mdr` (opcional)
- **Drag & Drop**: mesmo padrão nativo (HTML5 drag) já usado em Categorias
- **MDR**: ao arrastar uma categoria para "Taxas MDR", o sistema atualiza `dre_section = 'mdr'`; o DRE contábil precisará de ajuste menor para reconhecer essa nova seção

