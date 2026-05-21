# Hubs que fui convidado — suportar usuário owner+membro

## Causa raiz

Guilherme já tinha conta própria (é owner do próprio hub). O `HubContext` define `isHubMember` apenas a partir de `app_metadata.hub_member`, flag que só é gravada quando o `create-hub-member` cria um auth user novo. Para quem já existia, mesmo aceitando o convite, `isHubMember` continua `false`, então a tela `/eva-hub` mostra só o painel de owner e nunca lista os workspaces dos quais ele virou membro. O dado existe em `workspace_members` (status `active`) — só não é exibido.

A consequência também aparece no `useWorkspaceMembers`: `fetchAvailableWorkspaces` até roda para owners, mas o `EvaHub.tsx` só renderiza `MemberWorkspaceSelector` quando `isHubMember` é true, então a lista nunca aparece.

## O que ajustar

### 1. `HubContext` — detectar membership pelo banco
- Substituir a checagem de `app_metadata.hub_member` por uma query real:
  `select count from workspace_members where member_user_id = auth.uid() and status = 'active'`.
- Manter `isOwnerWithMembers` como hoje. Os dois passam a poder ser `true` simultaneamente.
- Expor um novo flag `hasInvitedWorkspaces` (boolean) e manter `isHubMember` como "sou membro de algum hub" (independente de ser owner).
- Restaurar impersonation persistida sempre que `hasInvitedWorkspaces` for true (não só quando o usuário é "puro membro").

### 2. `EvaHub.tsx` — layout combinado
Reorganizar a página em três blocos empilhados, exibidos conforme aplicável (não mais um `if/else` exclusivo):

1. **Convites recebidos** (já existe) — sem mudança visual.
2. **Hubs em que sou membro** — novo card/seção, sempre que `availableWorkspaces.length > 0`. Reaproveita o conteúdo atual de `MemberWorkspaceSelector` (lista de owners + botão "Entrar"). Título: "Hubs em que sou membro".
3. **Meu Hub** — `OwnerDashboard` atual, exibido quando o usuário tem plano que permite criar hub (mesma regra atual). Para quem é só membro convidado, esconde.

Assim, Guilherme verá:
- Convite pendente (se houver),
- "Hubs em que sou membro" com o hub do Renato,
- "Meu Hub" com seus próprios membros/workspaces.

### 3. `useWorkspaceMembers` — buscar tudo sempre
- Remover o `if (hub_member metadata)` do `useEffect` (linhas 156-166) e sempre rodar `fetchMembers`, `fetchWorkspaces`, `fetchOwnerProfile`, `fetchAvailableWorkspaces`, `fetchPendingInvitations` em paralelo. Esses fetches já são seguros (cada um filtra por owner_id ou member_user_id próprio).
- Após `acceptInvitation`, também disparar um refresh do `HubContext` (ex.: expor `refreshHubStatus()` no contexto e chamá-lo aqui) para que a nova seção apareça sem reload.

### 4. Sidebar / navegação
- O item "EVA Hub" já existe. Sem mudança de rota — tudo continua em `/eva-hub`.
- Pequeno badge no menu quando `pendingInvitations.length > 0` (opcional, baixo custo).

### 5. Sem mudanças de banco
RLS e tabelas já suportam o caso. Nada de migration.

## Detalhes técnicos

- Arquivos a editar:
  - `src/contexts/HubContext.tsx` (query + expor refresh + permitir coexistência).
  - `src/hooks/useWorkspaceMembers.ts` (sempre buscar tudo, chamar refresh após accept/reject).
  - `src/pages/EvaHub.tsx` (render combinado, extrair seções).
  - (opcional) `src/components/AppSidebar.tsx` para o badge de convites.
- Sem novas edge functions; `respond-hub-invitation` continua igual.
- Sem alterações em `subscriptions` — Guilherme já está com cortesia Família ativa.
