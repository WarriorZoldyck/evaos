## Ajustes na sidebar de Metas

### 1. Simplificar métricas (só mês vigente, base = fluxo de caixa)
Em `src/hooks/useMetasSidebarStats.ts`:
- Reaproveitar o mesmo pipeline do `useCashFlowData` / `useCashFlowMonthly` (fonte oficial de fluxo de caixa) em vez da query própria de `transactions`, para as médias baterem com o que o usuário vê no Fluxo de Caixa.
- Calcular **média mensal de entradas** e **média mensal de saídas** dividindo o total do ano corrente (ou dos últimos N meses fechados, alinhado ao Fluxo de Caixa) pelos meses decorridos.
- Manter: `totalBalance` (saldo atual do contexto), `avgIncomeMonth`, `avgSpentMonth`, `leftover = totalBalance − avgSpentMonth*mesesRestantes` (recalcular para refletir "sobra até dez/mês vigente" corretamente).
- Remover do estado retornado: `spentYear`, `projectedYearOut`, `totalIncomeYear`, `topCategories`, `allCategories` puros — passam a ser derivados sob demanda (ver item 3).
- Corrigir reatividade ao trocar contexto: garantir que a chave do `useEffect` inclua `selectedCompanyId` e `isPersonal` (já inclui via `contextKey`, mas validar que `useGoals` e a página `Metas` também refazem fetch por contexto — hoje as metas parecem não trocar quando o contexto muda; ajustar `useGoals` para filtrar por `company_id`/personal e reexecutar).

### 2. Categorias por tipo, sob demanda
Em vez de listar tudo:
- Novo hook (ou extensão do atual) retorna `categoriesByType(type: "receita" | "despesa")` que só busca quando chamado.
- Substituir a busca por `category` (texto) por join com a tabela `categories` para exibir **nome real** (bug atual: mostra UUID). Se o campo `transactions.category` armazena UUID, resolver via `useCategories` (map id→name); se armazena texto legado, manter fallback.
- Filtrar por `type` (entradas para receitas, saídas para despesas).

### 3. Interação: expandir ao clicar em Entradas/Saídas
Em `src/components/metas/MetasSidebar.tsx`:
- Cards "Média de entradas / mês" e "Média de saídas / mês" ficam clicáveis (accordion controlado por estado local `expanded: 'income' | 'expense' | null`).
- Ao expandir, renderizar logo abaixo do card clicado uma lista de categorias daquele tipo (com barra de proporção como hoje), carregada lazy.
- Só um aberto por vez; clicar de novo fecha. Layout permanece responsivo (o painel cresce naturalmente na coluna esquerda).
- Remover a seção fixa "Gastos por categoria".

### 4. Contexto correto nas metas
- Auditar `useGoals` para garantir filtro `company_id = selectedCompanyId` (ou `is null` quando `isPersonal`) e refetch ao trocar contexto.
- `MetasSidebar` já recebe `goals`; nada muda nele além de reagir corretamente.

### 5. Visual neumórfico (novo padrão global de cards da sidebar)
Aplicar aos `StatCard` e cards da sidebar de Metas:
- Fundo `#e0e0e0` (claro) / equivalente tokenizado no dark; `border-radius: ~28px`; sombra dupla `20px 20px 60px` (escura) + `-20px -20px 60px` (clara).
- Criar utilitário Tailwind/CSS (`.neu-card` em `src/index.css`) usando tokens HSL para funcionar em light/dark. Documentar como padrão a seguir daqui em diante (adicionar memória `mem://style/component-design/neumorphism`).
- Ajustar `StatCard` para usar a nova classe, mantendo variantes de tom (`primary`, `success`, `danger`) só no texto do valor.

### Detalhes técnicos
- Arquivos alterados: `src/hooks/useMetasSidebarStats.ts`, `src/components/metas/MetasSidebar.tsx`, `src/hooks/useGoals.ts` (se filtro de contexto faltar), `src/index.css` (classe neumórfica), possível novo `src/hooks/useCategoryBreakdown.ts` para lazy load por tipo.
- Sem mudança em edge functions, schema ou `ActionPlanDialog` (segue usando `gap`/`topCategories` — passaremos as top 3 despesas derivadas quando o accordion de saídas estiver expandido, ou recalculamos on-demand ao abrir o plano).
- Memória nova: registrar padrão neumórfico como base visual dos cards a partir de agora.
