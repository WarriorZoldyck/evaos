

# EVA Hub — Sistema de Multiusuários com Contas Gerenciadas

## Conceito

O EVA Hub e uma area separada onde o usuario principal (dono da conta) cria contas de acesso para membros convidados. Os membros NAO tem conta propria no EVA — o dono cria email/senha para eles. Ao fazer login, o membro convidado ve uma tela listando as areas de trabalho disponiveis e pode "entrar" (impersonar) em uma delas, operando o sistema com as permissoes definidas pelo dono.

## Fluxo

```text
DONO (usuario normal EVA):
  1. Acessa EVA Hub no sidebar
  2. Clica "Convidar Membro"
  3. Preenche: nome, email, senha, role (viewer/editor/admin)
  4. Seleciona quais empresas/contas o membro pode acessar
  5. Sistema cria conta no Supabase Auth + registro em workspace_members
  6. (opcional) Envia email com credenciais

MEMBRO CONVIDADO:
  1. Acessa /auth → faz login com email/senha criados pelo dono
  2. Sistema detecta que e membro hub (nao tem perfil proprio, so workspace_members)
  3. Redireciona para /eva-hub (tela de selecao de workspace)
  4. Ve lista de donos/empresas que tem acesso
  5. Clica "Entrar" → sistema seta contexto de impersonacao
  6. Navega pelo app normalmente, mas vendo dados do DONO
  7. RLS expandido permite acesso via funcao de seguranca
```

## Arquitetura de Dados

### Novas tabelas

**`workspace_members`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| owner_id | uuid NOT NULL | Dono da conta (quem criou) |
| member_user_id | uuid NOT NULL | ID auth do membro criado |
| email | text NOT NULL | Email do membro |
| role | text NOT NULL | `admin`, `editor`, `viewer` |
| status | text NOT NULL | `active`, `suspended` |
| created_at | timestamptz | |

**`workspace_member_permissions`**
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| workspace_member_id | uuid FK | |
| resource_type | text | `company`, `bank_account`, `credit_card` |
| resource_id | uuid | ID do recurso permitido |

### Funcao de seguranca (security definer)
`is_hub_member(member_uid, owner_uid)` — retorna true se o usuario e membro ativo do owner. Sera usada futuramente para expandir RLS.

### Funcao para criar membro
Edge Function `create-hub-member` — recebe nome, email, senha, role. Usa `supabase.auth.admin.createUser()` (service role) para criar a conta. Insere em `workspace_members`. Marca no user_metadata que e `hub_member: true` para diferenciar de usuarios normais.

## Implementacao

### Etapa 1: Migration SQL
- Criar `workspace_members` e `workspace_member_permissions` com RLS
- Funcao `is_hub_member`

### Etapa 2: Edge Function `create-hub-member`
- Recebe: name, email, password, role, owner_id
- Valida JWT do owner
- Cria usuario via admin API com metadata `{ hub_member: true, owner_id }`
- Insere em `workspace_members`
- Retorna sucesso

### Etapa 3: Contexto de impersonacao
- Criar `src/contexts/HubContext.tsx`
  - `impersonatingOwnerId: string | null` — quando setado, todas as queries usam esse owner como filtro
  - `isHubMember: boolean` — detectado via user_metadata
  - `exitImpersonation()` — volta para tela de selecao
- Atualizar `CompanyContext` para usar `impersonatingOwnerId` quando ativo (buscar companies do owner, nao do membro)

### Etapa 4: Hook `useWorkspaceMembers.ts`
- CRUD de membros (para o dono)
- `fetchAvailableWorkspaces()` — para o membro, lista owners que compartilharam acesso
- `updatePermissions()` — alterar recursos acessiveis

### Etapa 5: Pagina `/eva-hub`
**Para o DONO:**
- Lista de membros com status, role, acoes (editar, suspender, excluir)
- Modal de convite: nome, email, senha, role, checkboxes de empresas/contas
- Gerenciamento de permissoes por membro

**Para o MEMBRO (apos login):**
- Tela de selecao de workspace mostrando donos/empresas disponiveis
- Botao "Entrar" que seta impersonacao e redireciona para /dashboard

### Etapa 6: Auth redirect
- No `AppLayout`, detectar se user e `hub_member` (via metadata)
- Se sim e nao tem impersonacao ativa, redirecionar para `/eva-hub`
- Na pagina `/auth`, manter login unico (o sistema detecta automaticamente se e dono ou membro)

### Etapa 7: Sidebar condicional
- Item "EVA Hub" visivel para donos (que tem membros) e para membros (para trocar workspace)
- Badge com nome do workspace ativo quando impersonando

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas + RLS + funcao |
| `supabase/functions/create-hub-member/index.ts` | Criar — edge function para criar membro |
| `src/contexts/HubContext.tsx` | Criar — contexto de impersonacao |
| `src/hooks/useWorkspaceMembers.ts` | Criar — CRUD membros + workspaces |
| `src/pages/EvaHub.tsx` | Criar — pagina de gestao (dono) e selecao (membro) |
| `src/contexts/CompanyContext.tsx` | Editar — respeitar impersonacao |
| `src/components/layout/AppLayout.tsx` | Editar — detectar hub_member e redirecionar |
| `src/components/layout/AppSidebar.tsx` | Editar — item EVA Hub + indicador de impersonacao |
| `src/App.tsx` | Editar — nova rota |

## Seguranca

- Membros NAO podem acessar EVA Hub de gestao (so donos)
- Membros so veem dados do owner via impersonacao controlada
- A criacao de usuario e feita server-side com service_role (nunca no client)
- RLS expandido sera feito em etapa futura com `is_hub_member`

