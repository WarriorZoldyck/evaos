## Objetivo

Tornar o DRE estritamente baseado no que o usuário **atrelou manualmente** a um centro de custo. Categorias sem `dre_section` explícito (em si ou em algum ancestral) deixam de aparecer nas seções oficiais do DRE e passam a ser listadas apenas nas linhas informativas **"Receitas/Despesas Não Classificadas (fora do DRE)"**, abaixo do Lucro Líquido.

## Mudança principal

Arquivo: `src/hooks/useDREData.ts` — função `sectionFor` dentro de `contabilData` (useMemo).

Hoje a resolução tem 3 camadas:
1. `dre_section` explícito do ancestral (mantém)
2. Fallback por `type` da categoria raiz via `defaultSectionForType` (**remover**)
3. Fallback por `t.type` da transação (**remover**)

Passará a ter apenas a camada 1. Se nenhuma categoria na cadeia tiver `dre_section`, a transação vai para `receitas_nao_classificadas` ou `despesas_nao_classificadas` conforme `t.type`.

### Trecho atual (a alterar)

```ts
const sectionFor = (cat) => {
  // ... busca dre_section nos ancestrais ...
  // Fallback: root's type → default bucket
  const root = ancestry[ancestry.length - 1];
  const def = defaultSectionForType(root?.type);
  return (def as DreSectionKey | null) ?? null;   // ← remover este fallback
};

// ...
// Last-resort fallback based on the transaction's own type
if (!sectionKey) {
  const def = defaultSectionForType(t.type);     // ← remover este bloco
  if (def) sectionKey = def as DreSectionKey;
}
```

Ambos serão removidos. O bloco que já existe abaixo continua tratando o caso "sem mapeamento":

```ts
if (!sectionKey) {
  sectionKey = t.type === "receita" ? "receitas_nao_classificadas" : "despesas_nao_classificadas";
  if (chain[0]) unmappedCategoryIds.add(chain[0].id);
}
```

Isso já as joga nas linhas informativas que **não somam no Lucro Líquido** (a lógica `recLiquida = recOp - impVenda`, etc. continua intacta).

## Efeitos colaterais esperados (positivos)

- **Receita Operacional** e **Despesas Operacionais e Adm.** vão diminuir para usuários que tinham muitas categorias sem mapear — voltarão ao valor "real" do que está classificado.
- **Lucro Líquido** muda para esses usuários (passa a refletir só o classificado).
- O contador `unmappedCategoryCount` (já exibido em `CategoryDiagnosticsPanel` na página Centros de Custos) ficará mais alto, incentivando o usuário a arrastar as categorias para os buckets corretos.
- As seções "(i) Receitas/Despesas Não Classificadas (fora do DRE)" aparecem automaticamente quando houver valores (lógica `hasRecNc`/`hasDespNc` já existe).

## Limpeza opcional

A função `defaultSectionForType` em `src/lib/dreSections.ts` deixa de ser usada pelo DRE. Verificar usos restantes antes de remover:
- Se for usada apenas no DRE, remover.
- Se outras telas (Centros de Custos, formulário de categoria) dependerem dela para sugerir bucket inicial, **manter** — a sugestão na UI é útil; o que estamos removendo é a aplicação **silenciosa** dela no cálculo do DRE.

Vou rodar uma busca por usos antes de decidir.

## Compatibilidade

- Nenhuma migração de banco. Não altera dados existentes.
- Vale para **todos os usuários, presentes e futuros**, imediatamente após o deploy.
- Reversível trivialmente (basta recolocar os dois fallbacks).

## Validação

1. Abrir o DRE de uma conta que tinha categorias sem mapeamento e confirmar que:
   - Receita Operacional / Despesas Operacionais caíram para o valor das categorias com `dre_section` setado.
   - As linhas "(i) ... Não Classificadas" aparecem com os valores que antes inflavam o DRE.
   - Lucro Líquido reflete só o classificado.
2. Painel de Centros de Custos (`CategoryDiagnosticsPanel`) deve mostrar contagem coerente de categorias não mapeadas.
