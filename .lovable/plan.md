## Objetivo

Ao clicar em um card do grid de categorias (à direita, em "Categorias — Receitas e Despesas"), abrir um modal detalhado — no mesmo estilo do modal de Entradas/Saídas — mostrando os lançamentos daquela categoria específica no período atual.

Hoje esses cards navegam para `/lancamentos?category=...&type=...`. Passaremos a abrir o modal e ficar no Dashboard.

## Mudanças

### 1) `EntradasSaidasDetailModal.tsx`
Extender para suportar recorte por categoria:

- Nova prop opcional `categoryFilter?: { id: string; name: string; fill?: string }`.
- Nova prop opcional `titleOverride?: string`.
- Nova prop opcional `includeStatus?: "Pago" | "Pendente" | "Todos"` (default mantém o comportamento atual — `statusFilter` único). Para categorias, usaremos `"Todos"` para mostrar realizados + previstos daquela categoria no período.
- Filtro `lines` passa a considerar `categoryFilter` (comparando por `t.category === categoryFilter.id || t.category === categoryFilter.name`).
- Título dinâmico: `"{Categoria} · Entradas do período"` / `"...· Saídas do período"` (usa `titleOverride` se fornecido).
- `goToLancamentos` inclui `category={name}` na query string quando `categoryFilter` estiver definido.
- Nome do CSV inclui slug da categoria quando aplicável.

### 2) `CategoryDetailGrid.tsx`
- Nova prop opcional `onCategoryClick?: (item: { id: string; name: string; fill: string; value: number }, mode: "receita" | "despesa") => void`.
- No `<button>` de cada card, quando `onCategoryClick` estiver definido, chamar o handler em vez do `navigate(...)` atual. Sem handler, mantém o comportamento antigo (não quebra outros usos).

### 3) `CategoryBreakdownCard.tsx`
- Nova prop opcional `onCategoryClick` (repassada para `CategoryDetailGrid`).
- Manter as fatias do donut clicando para `/lancamentos` (comportamento atual) — ou também abrir o modal? **Escopo**: por ora, só o grid da direita, como você pediu ("cards do grid à direita"). Donuts continuam iguais.

### 4) `Dashboard.tsx`
- Novo estado `categoryModal: { open: boolean; mode: "receita" | "despesa"; category: { id, name, fill } | null }`.
- Passar `onCategoryClick={(item, mode) => setCategoryModal({ open: true, mode, category: item })}` ao `CategoryBreakdownCard`.
- Renderizar um `<EntradasSaidasDetailModal>` novo com:
  - `mode` = `categoryModal.mode === "receita" ? "entradas" : "saidas"`
  - `transactions` = `transactions` (mesmas usadas pelos outros modais — recorte por período/contexto já vem aplicado)
  - `categoryFilter` = `categoryModal.category`
  - `includeStatus="Todos"` (para mostrar pagos + pendentes da categoria)
  - `total` = soma dos itens filtrados naquele modo/categoria (já calculamos via `summary` — reaproveitar `revenueCategories`/`expenseCategories` para pegar o `.value`)
  - `prevTotal` = opcional; pode ser omitido (comparativo por categoria fica fora do escopo)
  - `dateFrom`/`dateTo`/`bankAccounts`/`wallets`/`creditCards`/`categoryNameResolver` = mesmos props já usados pelos modais existentes
  - `titleOverride` = `"{category.name} · {Receitas|Despesas} do período"`

## Verificação
- Clicar em qualquer card do grid direito abre o modal com o header referente à categoria e apenas seus lançamentos.
- Filtros internos (forma de pagamento, paginação, CSV, botão "Ver em Lançamentos") continuam funcionando; o botão "Ver em Lançamentos" leva com `category` já aplicado.
- Nenhum outro fluxo (donuts, modais de entradas/saídas gerais) é alterado.

## Fora do escopo
- Alterar comportamento das fatias do donut.
- Comparativo período anterior por categoria dentro do modal.
- Refatorar `EntradasSaidasDetailModal` além das props opcionais listadas.