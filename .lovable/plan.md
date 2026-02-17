

## Tornar a tabela do DRE e Plano de Caixa recursiva (N niveis de subcategorias)

### Problema atual
A estrutura de dados e a renderizacao atual suportam apenas 2 niveis (categoria raiz e filhos diretos). O sistema de categorias suporta 3 niveis (e potencialmente mais), mas o DRE/Plano de Caixa "achata" tudo -- caminha ate a raiz e agrupa o valor so no filho imediato da raiz, perdendo a hierarquia intermediaria.

### Solucao

Transformar tanto a estrutura de dados (`CategoryGroup`) quanto o componente de renderizacao (`CategoryReportTable`) para serem recursivos, permitindo expandir sub da sub em qualquer profundidade.

### Alteracoes tecnicas

**1. `src/hooks/useCashFlowData.ts` -- Estrutura de dados recursiva**

Alterar a interface `CategoryGroup` para que `children` tambem seja do tipo `CategoryGroup[]` (recursivo):

```typescript
export interface CategoryGroup {
  categoryId: string;
  categoryName: string;
  total: number;
  children: CategoryGroup[];  // recursivo em vez de { categoryId, name, total }[]
}
```

Refatorar o `useMemo` que agrupa transacoes:
- Em vez de resolver ate a raiz e agrupar so no filho direto, resolver a cadeia completa de ancestrais (ex: `[Raiz, SubA, SubB]`)
- Inserir o valor em cada nivel da arvore, criando nos intermediarios conforme necessario
- Manter a soma acumulada em cada nivel (pai inclui totais dos filhos)

**2. `src/components/relatorios/CategoryReportTable.tsx` -- Renderizacao recursiva**

Criar um componente recursivo `CategoryRow` que:
- Recebe um `CategoryGroup` e o `level` (profundidade)
- Mostra o chevron de expandir/colapsar se tiver filhos
- Ao expandir, renderiza os filhos como `CategoryRow` com `level + 1`
- O padding-left aumenta conforme o level (ex: `pl-6`, `pl-12`, `pl-18`)
- O estado de expansao (`expanded`) e gerenciado por um unico `Set<string>` no componente `SectionRows`

O resultado visual sera:
```text
RECEITAS                    R$ 10.000
  > Vendas                   R$ 8.000
      > Produtos              R$ 5.000
          Eletronicos          R$ 3.000
          Acessorios           R$ 2.000
      > Servicos              R$ 3.000
  > Investimentos            R$ 2.000
```

### Arquivos modificados
- `src/hooks/useCashFlowData.ts` -- interface e logica de agrupamento
- `src/components/relatorios/CategoryReportTable.tsx` -- renderizacao recursiva
