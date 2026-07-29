## Objetivo
Renomear completamente "Plano de Caixa" para "Fluxo de Caixa" — textos, rota, arquivo e componente — sem deixar referências ao nome antigo.

## Alterações

**Textos visíveis** (label "Plano de Caixa" / "Plano de caixa" → "Fluxo de Caixa" / "Fluxo de caixa"):
- `src/pages/PlanoDeCaixa.tsx` — título e parágrafo explicativo
- `src/pages/Docs.tsx` — item do menu, lista de features e seção `cashflow`
- `src/components/layout/AppSidebar.tsx` — item de navegação e texto de ajuda sobre multi-seleção
- `src/components/landing/LandingPricing.tsx` — item da lista de features
- `src/components/landing/LandingFeatures.tsx` — título do card

**Rota e arquivo**:
- Renomear `src/pages/PlanoDeCaixa.tsx` → `src/pages/FluxoDeCaixa.tsx`
- Renomear o componente `PlanoDeCaixa` → `FluxoDeCaixa`
- Atualizar import em `src/App.tsx`
- Alterar rota `/plano-de-caixa` → `/fluxo-de-caixa` (em `App.tsx` e no `AppSidebar.tsx`)

## Fora de escopo
Nenhuma alteração em dados, banco, lógica de cálculo ou testes — apenas nomenclatura/roteamento.
