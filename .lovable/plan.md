

# EVA Hub — Layout e Navegação Próprios

## Problema
Quando o usuario acessa o EVA Hub, ele ve o mesmo sidebar do app normal (Dashboard, Lancamentos, Financeiro, Cadastros...). O EVA Hub precisa ter **sua propria navegacao**, completamente separada, com menu proprio.

## Menu do EVA Hub (sidebar dedicado)

```text
┌─────────────────────┐
│  EVA OS (logo)      │
│  ─── EVA Hub ───    │
│                     │
│  🏢 Contas          │  ← lista as contas/empresas do dono, clicar = entrar na conta
│  📂 Áreas de Trabalho│  ← criar/gerenciar departamentos
│  👥 Membros         │  ← ver membros, permissoes, convidar
│                     │
│  ─────────────────  │
│  🔙 Sair do Hub     │
└─────────────────────┘
```

## Implementacao

### 1. Criar `HubSidebar` — sidebar dedicado do EVA Hub
Novo componente `src/components/layout/HubSidebar.tsx` com itens fixos:
- **Contas** — `/eva-hub/contas`
- **Áreas de Trabalho** — `/eva-hub/workspaces`
- **Membros** — `/eva-hub/membros`
- Botao "Sair" (logout)

### 2. Criar `HubLayout` — layout wrapper separado
Novo componente `src/components/layout/HubLayout.tsx`:
- Usa `HubSidebar` em vez de `AppSidebar`
- NAO mostra botao "Novo Lancamento"
- NAO mostra OnboardingGuide nem EvaChatButton
- Header simples com badge "EVA Hub" e ThemeToggle

### 3. Criar 3 sub-paginas do Hub
- `src/pages/hub/HubContas.tsx` — mostra a conta principal do usuario (nome, empresa, CNPJ). Botao "Entrar" faz impersonation e navega pro /dashboard
- `src/pages/hub/HubWorkspaces.tsx` — CRUD de areas de trabalho. Departamentos pre-setados sugeridos: "Financeiro", "Contabilidade", "Comercial", "Operacoes", "Administrativo"
- `src/pages/hub/HubMembros.tsx` — lista membros, quantos ativos, quantos suspensos, convidar novos. Mover logica existente do EvaHub.tsx (MemberCard, InviteMemberModal)

### 4. Atualizar rotas em App.tsx
Trocar a rota unica `/eva-hub` por um grupo com layout proprio:

```text
<Route element={<HubLayout />}>
  <Route path="/eva-hub" element={<Navigate to="/eva-hub/contas" />} />
  <Route path="/eva-hub/contas" element={<HubContas />} />
  <Route path="/eva-hub/workspaces" element={<HubWorkspaces />} />
  <Route path="/eva-hub/membros" element={<HubMembros />} />
</Route>
```

### 5. AppLayout — nao renderizar sidebar do app normal quando em /eva-hub
O redirect em `AppLayoutInner` ja manda hub_members sem impersonation para `/eva-hub`. Agora `/eva-hub` tera seu proprio layout, entao sai do `<Route element={<AppLayout />}>`.

### 6. EvaHub.tsx — manter MemberWorkspaceSelector para membros convidados
Membros com `hub_member=true` continuam vendo a tela de selecao de workspace. Essa tela pode ser a pagina `/eva-hub/contas` para membros (com visual de selecao em vez de gestao).

## Arquivos afetados
| Arquivo | Acao |
|---------|------|
| `src/components/layout/HubSidebar.tsx` | Criar — sidebar dedicado |
| `src/components/layout/HubLayout.tsx` | Criar — layout wrapper |
| `src/pages/hub/HubContas.tsx` | Criar — visao de contas |
| `src/pages/hub/HubWorkspaces.tsx` | Criar — gestao de departamentos |
| `src/pages/hub/HubMembros.tsx` | Criar — gestao de membros |
| `src/App.tsx` | Mover `/eva-hub` para grupo com HubLayout |
| `src/pages/EvaHub.tsx` | Simplificar ou remover (logica distribuida nas sub-paginas) |

