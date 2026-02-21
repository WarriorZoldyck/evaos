

## Icones de Receita/Despesa clicaveis para criar categoria

Ao clicar no icone verde (Canais de Receita) ou vermelho (Centros de Despesa), abre o modal de criacao de categoria com o tipo ja pre-selecionado.

### Alteracoes

**`src/pages/Categorias.tsx`**
- Adicionar estado `defaultType: string` (inicializa como "receita")
- Criar funcao `openCreateRoot(type)` que limpa parentId/editData, define defaultType e abre o modal
- Tornar os dois `div` dos icones clicaveis com `cursor-pointer`, `hover:bg-*` e `onClick={() => openCreateRoot("receita"/"despesa")}`
- Passar `defaultType` ao `CategoryFormModal`

**`src/components/categorias/CategoryFormModal.tsx`**
- Adicionar prop opcional `defaultType?: string`
- No `useEffect` de abertura, usar `editData?.type || defaultType || "ambos"` como valor inicial do tipo

### Detalhes tecnicos

Icone verde:
```tsx
<div
  className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center cursor-pointer hover:bg-emerald-500/20 transition-colors"
  onClick={() => openCreateRoot("receita")}
  title="Criar categoria de receita"
>
  <TrendingUp className="h-4 w-4 text-emerald-500" />
</div>
```

Icone vermelho:
```tsx
<div
  className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center cursor-pointer hover:bg-red-500/20 transition-colors"
  onClick={() => openCreateRoot("despesa")}
  title="Criar categoria de despesa"
>
  <TrendingDown className="h-4 w-4 text-red-500" />
</div>
```

Funcao auxiliar:
```tsx
const openCreateRoot = (type: string) => {
  setParentId(null);
  setParentName(undefined);
  setEditData(null);
  setDefaultType(type);
  setFormOpen(true);
};
```

No modal, o useEffect fica:
```tsx
setType(editData?.type || defaultType || "ambos");
```

| Arquivo | Acao |
|---------|------|
| `src/pages/Categorias.tsx` | Icones clicaveis, estado defaultType, funcao openCreateRoot |
| `src/components/categorias/CategoryFormModal.tsx` | Prop defaultType no useEffect |

