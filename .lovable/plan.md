

## Plano: Categorias fechadas por padrão + Centro de Custo no formulário

### Problema
1. Na página de Categorias, as pastas raiz estão abrindo expandidas (comportamento antigo era fechadas)
2. A página de Centros de Custos não mostra automaticamente as categorias que já possuem `dre_section` definido — na verdade ela já faz isso (linha 122), mas o usuário pode não ter nenhuma categoria com `dre_section` preenchido ainda
3. O formulário de criação de categoria já tem o campo "Seção do DRE" mas com label técnico — precisa renomear para "Centro de Custo" e filtrar as opções conforme o tipo (receita/despesa)

### Alterações

**1. `CategoryTreeItem.tsx` — Categorias fechadas por padrão**
- Linha 29: mudar `useState(level === 0)` para `useState(false)` — todas nascem fechadas

**2. `CategoryFormModal.tsx` — Renomear "Seção do DRE" para "Centro de Custo" e filtrar por tipo**
- Renomear o label de "Seção do DRE" para "Centro de Custo"
- Atualizar a descrição para "Vincule esta categoria a um centro de custo para o DRE"
- Filtrar as opções: se o tipo selecionado for "receita", mostrar apenas centros com sinal "+"; se "despesa", apenas sinal "-"; se "ambos", mostrar todos
- Manter a opção "Nenhum" (em vez de "Automático") como padrão

**3. `CentrosDeCustos.tsx` — Garantir que categorias com `dre_section` já apareçam nas pastas**
- Já funciona corretamente (linha 122 filtra por `dre_section === section.key`), mas não há problema de código — o sistema já auto-detecta. O que precisa é apenas garantir que ao abrir a página pela primeira vez, as seções que têm categorias vinculadas comecem expandidas automaticamente.

### Detalhes técnicos
- Nenhuma migração de banco necessária — `dre_section` já existe
- A filtragem por tipo no formulário usa o array DRE_SECTIONS com propriedade `sign` para determinar receita (+) vs despesa (-)
- Impacto zero em outros módulos

