## Diagnóstico

Confirmei no banco:

- Nayara (`nayarapereira.med@gmail.com`, id `2eec6f87…`) tem sim um registro em `workspace_members` criado pelo Rômulo (`owner_id = 9716acbe…`), `role=admin`, `status='pending'`, `workspace_id=null`.
- Rômulo tem assinatura ativa do plano **Família** (`max_users=3`), então o convite é legítimo — o rótulo "exclusividade plano Família" que apareceu para Nayara é engano da UI, não bloqueio real da conta dele.
- `create-hub-member` (que Rômulo usou) **não envia nenhum e-mail** hoje: só grava o `pending` na tabela. Por isso Nayara não recebeu convite.
- A tela onde os convites pendentes aparecem (`/hub` → `EvaHub.tsx`) está envolvida pelo `HubLayout.tsx`, que bloqueia qualquer usuário cujo `usePlanLimits().hubAllowed === false` **e** que não seja `isHubMember` **e** que não seja `isOwnerWithMembers`. E o `HubContext` só marca `isHubMember=true` para memberships com `status='active'` — quem tem apenas convite pendente cai fora dos três critérios e recebe a UpgradeGate "EVA Hub é exclusivo do plano Família".
- Resultado: Nayara nunca consegue chegar até o botão "Aceitar convite", e como também não há e-mail, ela fica sem nenhum canal para descobrir/aceitar o convite.

## Correções propostas (todas globais, sem gambiarra para essa conta)

### 1. Deixar convites pendentes passarem pelo `HubLayout`
- Em `HubContext.tsx`: expor um novo flag `hasPendingInvitations` (contando linhas em `workspace_members` para `member_user_id = user.id` com `status='pending'`). Atualizar junto com o resto no `refreshHubStatus`.
- Em `HubLayout.tsx`: mudar o guard para
  `if (!hubAllowed && !isHubMember && !isOwnerWithMembers && !hasPendingInvitations) { <UpgradeGate/> }`.
- Efeito: convidado consegue entrar em `/hub`, ver e aceitar/recusar o convite. Depois de aceitar, o `isHubMember=true` normal cuida do resto.

### 2. Ajustar a mensagem da UpgradeGate quando fizer sentido
- Se o usuário chega em `/hub` sem convite e sem membros, mantemos a UpgradeGate atual (correto para owner sem plano).
- Nenhuma mudança na cobrança — só copy e condição de exibição.

### 3. Notificar o convidado por e-mail
Duas alternativas (pedir escolha):
- **A. E-mail próprio da EVA** (recomendado): estender `create-hub-member` para, quando encontra um usuário existente, chamar o Email API (mesmo caminho do `auth-email-hook`, via `@lovable.dev/email-js`) e enviar um novo template `hub-invite.tsx` com botão "Ver convite" → `https://eva.tec.br/hub`. Depende do domínio `notify.eva.tec.br` verificado — hoje ele está com verificação DNS expirada. Enquanto o DNS não valida, o e-mail cai no fluxo de fallback do provisionamento.
- **B. Sem e-mail agora**: mostrar aviso in-app no login (toast/badge no menu) contando quantos convites pendentes há. Rápido e não depende de DNS.

Sugestão: fazer **B agora** (imediato, sem depender de infra) e **A** logo em seguida quando o DNS de `notify.eva.tec.br` estiver ok.

### 4. Notificação in-app leve (parte do B)
- Já temos `pendingInvitations` em `useWorkspaceMembers`. Adicionar um badge com a contagem no item "EVA Hub" da sidebar (`AppSidebar.tsx`) e um `toast.info` uma vez por sessão quando `pendingInvitations.length > 0`, com ação "Ver convites" → `/hub`.

## Detalhes técnicos

Arquivos a editar:
- `src/contexts/HubContext.tsx` — nova query de pendentes + campo no contexto.
- `src/components/layout/HubLayout.tsx` — incluir `hasPendingInvitations` no guard.
- `src/components/layout/AppSidebar.tsx` — badge no link do Hub.
- `src/App.tsx` (ou provider raiz do layout autenticado) — toast único por sessão quando houver pendentes.

Sem migration necessária. Nenhuma alteração em RLS (as policies de `workspace_members` já permitem o convidado ler o próprio convite via `member_user_id = auth.uid()`).

## Pergunta para você antes de implementar

Qual caminho para o convite? **B agora** (só in-app) ou **A + B** (in-app já e e-mail assim que o `notify.eva.tec.br` verificar)?
