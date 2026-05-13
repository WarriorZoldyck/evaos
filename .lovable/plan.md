## Resumo dos problemas

A área do **membro convidado** no Hub está confusa. Vamos arrumar item a item, mantendo intacta a visão do dono.

| # | Problema | Onde |
|---|---|---|
| 1 | Em **Contas**, o membro vê o e-mail dele em vez da conta do cliente que o convidou | `HubContas.tsx` |
| 2 | Membros enxergam a aba **Membros** (com total/ativos/suspensos) — não devem | `HubSidebar.tsx`, `App.tsx` |
| 3 | Em **Áreas de Trabalho**, o membro consegue criar áreas (devia só ver as do dono) e não há botão claro de "voltar/sair" | `HubWorkspaces.tsx` |
| 4 | Membro clica em uma área e não acessa nada — falta de fluxo | `HubWorkspaces.tsx` |
| 5 | **Auditoria** está visível para qualquer membro; deve ficar restrita a admins (e ao dono) | `HubSidebar.tsx`, `HubAuditoria.tsx` |

## Mudanças propostas

### 1. Contas (membro)
Em `HubContas.tsx`, a visão do membro vai exibir um **card por cliente (owner)**, não mais o próprio perfil:
- Nome do dono + nome da empresa principal (se houver) + CNPJ
- Badge do papel concedido (admin/editor/viewer)
- Botão **Entrar** → executa `setImpersonation(...)` e leva ao `/dashboard` daquele cliente
- Mantém o botão "Sair desta conta" (já existente)
- Cabeçalho passa a ser "Meus Clientes — N contas"
- Estado vazio: "Aguarde um convite de um proprietário"

Para puxar a empresa de cada owner, usamos `companies` (RLS já permite leitura para hub member) e fazemos um `select` agrupado por `owner_id` no `useWorkspaceMembers` (estender `availableWorkspaces` com `companyName/cnpj`).

### 2. Sidebar do Hub: itens condicionais ao papel
Em `HubSidebar.tsx`, o menu vai depender de `isHubMember` + papel mais alto entre os clientes:

- **Dono** (não-membro): Contas, Áreas de Trabalho, Membros, Auditoria
- **Membro convidado**: Contas, Áreas de Trabalho
- **Membro com papel `admin` em pelo menos um cliente**: Contas, Áreas de Trabalho, **Auditoria** (apenas das próprias ações)

A aba **Membros** **nunca** aparece para membros. As rotas correspondentes (`/eva-hub/membros`, `/eva-hub/auditoria`) ganham guarda em `App.tsx`/no próprio componente: se `isHubMember` e papel insuficiente → `Navigate to="/eva-hub/contas"`.

### 3. Áreas de Trabalho (membro)
Em `HubWorkspaces.tsx`, criar uma branch para `isHubMember`:
- Esconder botão "Criar", presets e modal de criação
- Listar somente as áreas do dono atualmente impersonado
  - Se nenhum cliente estiver selecionado, mostrar primeiro o **seletor de cliente** ("Selecione uma conta para ver as áreas") com atalhos para os owners disponíveis
- Cada card mostra apenas nome/descrição (sem contagem de membros, sem lixeira)
- Adicionar botão **"Voltar para Contas"** no topo

### 4. Fluxo ao clicar em uma área (membro)
Hoje o card de área não tem ação. Para o membro, ao clicar:
1. Garantir `setImpersonation` do dono daquela área (caso ainda não esteja)
2. Navegar para `/dashboard` já com filtro contextual aplicado (passar `?workspace_id=...` na URL ou armazenar no `HubContext` como `activeWorkspaceId`)

Não criamos novas tabelas — só usamos `workspace_members.workspace_id` já existente para filtrar.

### 5. Auditoria
Em `HubAuditoria.tsx`:
- Adicionar guarda no topo: `if (isHubMember && !isAdminInAnyClient) return <Navigate to="/eva-hub/contas" />`
- Para o membro admin: filtrar `hub_audit_log` por `actor_user_id = me` (RLS já permite isso) e ocultar o filtro de "outros usuários"
- O dono continua vendo tudo (já é o comportamento atual)

Sidebar esconde o item "Auditoria" se o membro não for admin em nenhum cliente.

### 6. Pequenos ajustes UX
- Header do `HubLayout` já tem botão "Voltar" para dono; espelhar para membro também (ele volta para `/eva-hub/contas`).
- Renomear título da página para `EVA Hub — Cliente: {ownerName}` quando estiver impersonando, para deixar claro o contexto.

## Arquivos afetados (tudo frontend, sem migração)

- `src/pages/hub/HubContas.tsx` — refatorar visão do membro
- `src/pages/hub/HubWorkspaces.tsx` — visão read-only para membros + ação ao clicar
- `src/pages/hub/HubAuditoria.tsx` — guarda por papel, escopo do membro
- `src/components/layout/HubSidebar.tsx` — menu condicional
- `src/components/layout/HubLayout.tsx` — botão voltar também para membros
- `src/contexts/HubContext.tsx` — expor `isAdminInAnyClient` e `activeWorkspaceId`
- `src/hooks/useWorkspaceMembers.ts` — enriquecer `availableWorkspaces` com empresa/CNPJ
- (opcional) `src/App.tsx` — guardas de rota

## Fora de escopo
- Convites por email (já marcado como provisório)
- Filtros financeiros por workspace dentro do `/dashboard` (pode ser próximo passo, hoje só passamos o `workspace_id` na URL)
- Mudanças em RLS — não são necessárias; tudo se resolve no front + filtros no Supabase client
