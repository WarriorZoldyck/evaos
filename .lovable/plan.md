## Objetivo

Mover o seletor de conta + `PeriodFilter` do Dashboard para **dentro do próprio header global** (o mesmo que hoje já tem o botão "Novo Lançamento" e o ThemeToggle), centralizados. Elimina a segunda barra sticky e a faixa quebrada, deixando **um único cabeçalho** fixo no topo — idêntico em altura e nível visual à página de Lançamentos.

## Arquitetura

Criar um mecanismo simples de "slot" no header global para que qualquer página possa injetar controles próprios, sem que o `AppLayout` precise conhecer o estado interno de cada tela.

### 1) Novo: `src/contexts/HeaderSlotContext.tsx`
- Contexto React expondo `{ content, setContent }`.
- Hook `useHeaderSlot(node)` que faz `setContent(node)` no mount e limpa no unmount.
- Provider embrulha o `AppLayout`.

### 2) `src/components/layout/AppLayout.tsx`
Reorganizar o `<header>` em 3 zonas com `justify-between`:
- **Esquerda:** `SidebarTrigger` + badge de impersonation (como hoje).
- **Centro (novo):** renderiza `{headerSlot.content}` — centralizado com `flex-1 flex justify-center`.
- **Direita:** botão "Novo Lançamento" + `ThemeToggle` (como hoje).

Se o slot estiver vazio, a área central fica só como spacer (nada quebra em outras páginas).

### 3) `src/pages/Dashboard.tsx`
- **Remover** o wrapper sticky com o título "Dashboard" + filtros.
- Manter apenas um bloco de contexto discreto no corpo (ex.: subtítulo `Visão geral — IMPLANTES BR LTDA`) ou remover, já que "Dashboard" já é o item ativo no sidebar.
- Chamar `useHeaderSlot(<DashboardHeaderControls />)` para injetar no header:
  - `Select` "Todas as contas / ..." (versão compacta, `h-8 text-xs`).
  - `PeriodFilter` (já compacto).
  - Ambos em `flex items-center gap-3`.

### 4) Ajustes finos de UX
- Em telas estreitas (`< md`), esconder o botão "Novo Lançamento" já esconde o texto (`hidden sm:inline`); o slot central pode virar `flex-wrap` para não estourar. Se ainda assim ficar apertado, o `PeriodFilter` já colapsa naturalmente.
- Header global mantém `h-14 sticky top-0 z-40` — já era fixo, então nada precisa mudar no scroll behavior conquistado no passo anterior.

## Verificação
- Ao entrar no Dashboard: os filtros aparecem centralizados no header global; não há mais barra secundária.
- Ao rolar: header único permanece fixo (é o mesmo comportamento do header em Lançamentos).
- Em outras páginas (Lançamentos, Plano de Caixa, etc.): o slot central fica vazio, header inalterado.

## Fora do escopo
- Migrar filtros de outras páginas para o slot (podemos fazer depois se quiser padronizar).
- Redesign do header global (cor, altura, tipografia).
- Alterações nos cards, `FinancialHealthBar` ou demais seções do Dashboard.