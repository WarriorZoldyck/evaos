# Revisão do EVA Hub — o que falta para 100%

## Diagnóstico atual

A tela que você mostrou (**Contas / Áreas de Trabalho / Membros**) cobre o fluxo *básico*, mas hoje o Hub funciona como uma **delegação total**: o membro entra na conta do dono e vê **tudo**, independentemente do papel (`viewer/editor/admin`) e do departamento atribuído.

| Funcionalidade visível | Status real |
|---|---|
| Listar/criar/suspender membro | OK |
| Definir papel (Admin/Editor/Visualizador) | Salvo no banco, **não é aplicado** em lugar nenhum |
| Atribuir membro a uma Área (Contabilidade etc.) | Salvo no banco, **não filtra dados** |
| Convite por e-mail real | Não existe — dono digita senha e repassa manualmente |
| Persistir impersonação ao recarregar | Não — some ao dar F5 |
| `workspace_member_permissions` (já existe a tabela!) | Vazia, sem UI, sem uso |

## Cenário do cliente (contador / familiar)

Para o caso "contratei um escritório de contabilidade e quero que ele veja **só** a empresa X" ou "convidei minha esposa para gerenciar **só** o cartão pessoal", o fluxo atual **não atende** — o convidado entra e vê tudo.

---

## Plano de entrega (5 frentes)

### 1. Convite por e-mail real (substituir o "criar com senha")
- Trocar `create-hub-member` por `invite-hub-member`: usa `admin.inviteUserByEmail` do Supabase com `redirectTo=/aceitar-convite?token=…`.
- Criar tabela `hub_invitations` (owner_id, email, role, workspace_id, scoped_resources jsonb, token, expires_at, status).
- Página `/aceitar-convite`: convidado define a própria senha, vira `hub_member=true` em `app_metadata`, cria a row em `workspace_members`.
- Estados no card: **Pendente / Ativo / Suspenso** + botão "Reenviar convite".

### 2. Aplicar o papel (role enforcement)
- Função SQL `public.hub_member_role(_user uuid, _owner uuid)` (SECURITY DEFINER).
- Atualizar policies que hoje fazem `OR is_hub_member(...)`:
  - **SELECT**: qualquer role ativo.
  - **INSERT/UPDATE/DELETE**: só `editor` ou `admin`.
  - **DELETE de configurações sensíveis** (contas, empresas, cartões, usuários): só `admin`.
- Hook `useHubRole()` no front para esconder botões de ação quando `viewer`.

### 3. Permissões por departamento (o ponto-chave do cenário do contador)
A tabela `workspace_member_permissions(workspace_member_id, resource_type, resource_id)` já existe — falta usar:
- UI no `MemberCard`: quando o membro tem uma Área atribuída, abrir um painel "**Acesso a:**" com checkboxes de:
  - Empresas (`companies`)
  - Contas bancárias (`bank_accounts`)
  - Cartões (`credit_cards`)
  - Maquininhas (`card_terminals`)
  - Carteiras (`wallets`)
- Função `public.hub_member_can_see(_user uuid, _resource_type text, _resource_id uuid)`:
  - Se membro **não tem nenhuma** permissão registrada → vê tudo do dono (compatibilidade).
  - Se tem → só vê os IDs listados (e os `transactions` ligados a esses IDs).
- Estender as RLS policies de `transactions`, `companies`, `bank_accounts`, `credit_cards`, `card_terminals`, `wallets`, `goals`, `categories` para chamar `hub_member_can_see` quando for hub member.
- Preset por Área (Departamento Contabilidade → liberar todas as `companies` PJ; Departamento Pessoal → liberar carteiras/contas Pessoal).

### 4. Robustez de impersonação
- Persistir `impersonatingOwnerId/Name` em `localStorage` (chave `eva.hub.impersonation`).
- Limpar no logout e ao mudar de usuário.
- Banner topo já existe — adicionar role ativo e nome do departamento ao lado do nome do dono.
- Log mínimo: tabela `hub_audit_log(actor_user_id, owner_id, action, payload, created_at)` registrando ações de escrita feitas em modo impersonação.

### 5. Polimentos finais para entrega
- **Ao suspender membro**: revogar sessões via `admin.signOut(memberUserId, "global")`.
- **Excluir membro definitivamente** (hoje só suspende).
- **Membro sair sozinho** de uma Conta (botão na tela `HubContas`).
- **Reset de senha** do membro pelo dono (`admin.generateLink type=recovery`).
- **Validação de e-mail duplicado** no convite (mostra "já é membro").
- **N+1 fix** em `fetchAvailableWorkspaces` (1 query com join em `profiles`).
- **Limites de plano**: bloquear convite quando `usage.hubMembers >= max_hub_members` já está OK; adicionar mesma checagem em "reativar suspenso".
- **Onboarding do membro recém-aceito**: ao entrar a 1ª vez, ir direto para `/eva-hub` (HubContas) com hint "Selecione uma conta para começar".

---

## Resposta direta às suas perguntas

> **As funções da imagem (Contas / Áreas de Trabalho / Membros) estão funcionais?**
Sim, **a CRUD funciona**. Mas papel e área **não restringem nada hoje** — são só rótulos.

> **São as únicas necessárias?**
Faltam: **Convites pendentes**, **Reset de senha**, **Sair da conta** (lado membro), **Excluir membro** (lado dono) e **Permissões por recurso**.

> **É possível adicionar membro a um departamento com as permissões corretas?**
Adicionar a um departamento: ✅. Com **permissões corretas restringindo dados**: ❌ — é justamente o item 3 do plano.

---

## Detalhes técnicos

- Tabelas novas: `hub_invitations`, `hub_audit_log`.
- Tabela existente a ativar: `workspace_member_permissions`.
- Funções SQL novas: `hub_member_role`, `hub_member_can_see`.
- Edge functions novas: `invite-hub-member`, `accept-hub-invitation`, `revoke-hub-member`, `reset-hub-member-password`.
- Páginas novas: `/aceitar-convite`.
- Hooks novos: `useHubRole`, `useHubPermissions`.
- Migration adicional nas RLS de ~10 tabelas para chamar `hub_member_can_see`.

## Sugestão de execução em fases (cada uma já entregável)
1. **Fase A — Convite real + persistência de impersonação** (desbloqueia o caso "convidei o contador").
2. **Fase B — Role enforcement** (viewer realmente só lê).
3. **Fase C — Permissões por departamento/recurso** (contador vê só a empresa contratante).
4. **Fase D — Polimentos** (auditoria, reset de senha, sair da conta, excluir membro).
