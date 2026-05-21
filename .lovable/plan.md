# Convites do Hub para usuários EVA existentes

Hoje o EVA Hub só permite **criar membros novos** (a função `create-hub-member` sempre cria um usuário de auth com senha). Se o e-mail já existe na plataforma, o convite falha com 409. Vamos permitir que usuários EVA existentes recebam um convite e o aceitem mantendo a própria conta.

## Como vai funcionar (UX)

1. No modal "Convidar Membro" (`HubMembros.tsx`), o campo **senha** vira opcional. Texto de apoio:
   - "Se o e-mail já tiver conta EVA, ele receberá um convite para aceitar e a senha não é necessária."
2. Ao enviar:
   - **E-mail já existe na EVA** → cria um registro `workspace_members` com `status = 'pending'` ligado ao `user_id` existente. Não altera senha nem metadata da conta dele.
   - **E-mail novo** → fluxo atual (cria usuário com senha + `hub_member=true` + membership `active`).
3. O usuário convidado vê os convites pendentes em duas áreas:
   - **Sidebar (HubContext switcher)** — badge "Convites (N)".
   - **Página `/eva-hub`** (ou nova seção "Convites Recebidos") — lista cada convite com nome do owner, papel proposto, botões **Aceitar** / **Recusar**.
4. Aceitar → `status='active'` e o workspace aparece imediatamente em `availableWorkspaces`. Recusar → remove o registro.

## Mudanças técnicas

### Banco (`workspace_members`)
- Garantir que `status` aceita `'pending'` (já é `text`; só revisar constraints/RLS).
- RLS adicional: o usuário convidado (`auth.uid() = member_user_id`) precisa poder:
  - `SELECT` suas próprias linhas pendentes;
  - `UPDATE` apenas o próprio `status` de `pending → active`;
  - `DELETE` apenas as próprias linhas pendentes (recusar).
- Garantir que `is_hub_member` e `hub_member_can_see` continuam filtrando `status='active'` (já fazem).

### Edge functions
- **`create-hub-member`** (editar):
  - Tornar `password` opcional.
  - Antes de criar usuário, procurar `auth.users` por e-mail (via `adminClient.auth.admin.listUsers` paginado ou função RPC). Se achar:
    - Validar que não é o próprio owner e que ainda não existe membership ativa/pendente.
    - Inserir `workspace_members` com `status='pending'`, `member_user_id=<existing>`, sem mexer em `app_metadata` da conta dele.
    - Responder `{ success: true, pending: true }`.
  - Se não achar: exigir `password` (mensagem amigável se faltar) e seguir fluxo atual com `status='active'`.
  - O limite de plano (`max_hub_members`) continua contando convites pendentes + ativos.
- **`respond-hub-invitation`** (nova):
  - Body: `{ memberId, action: 'accept' | 'reject' }`.
  - Valida JWT → confirma `member_user_id = auth.uid()` e `status='pending'`.
  - Accept → update `status='active'` + grava em `hub_audit_log`.
  - Reject → delete + grava em `hub_audit_log`.

### Frontend
- **`useWorkspaceMembers.ts`**:
  - `createMember(name, email, password?, role)` — password opcional.
  - Novo hook `usePendingInvitations()` (ou estender o existente) que lê `workspace_members` onde `member_user_id = user.id AND status='pending'` com nome do owner.
  - `acceptInvitation(memberId)` / `rejectInvitation(memberId)` chamando a nova edge function.
- **`HubMembros.tsx`** (modal de convite): senha opcional, dica explicando os dois cenários, e listar membros `pending` na tabela com badge "Aguardando aceitação".
- **`EvaHub.tsx`** (ou `HubLayout`): seção "Convites recebidos" com botões Aceitar / Recusar. Toast de feedback.
- **Sidebar/switcher de contexto**: exibir contagem de convites pendentes.

## Fora de escopo
- Envio de e-mail de notificação (pode ser feito depois — por ora o usuário vê o convite ao logar).
- Convites por link/token para e-mails ainda não cadastrados (segue o fluxo de criar conta com senha).
- Mudanças em billing/limite de plano além de incluir pendentes na contagem.

## Arquivos afetados
- `supabase/functions/create-hub-member/index.ts`
- `supabase/functions/respond-hub-invitation/index.ts` (novo)
- Migração SQL: políticas RLS em `workspace_members` para o convidado.
- `src/hooks/useWorkspaceMembers.ts`
- `src/pages/hub/HubMembros.tsx`
- `src/pages/EvaHub.tsx` (+ possível ajuste em `HubLayout`/sidebar para badge)
