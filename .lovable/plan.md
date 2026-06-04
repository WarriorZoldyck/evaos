## Objetivo

Permitir que um membro convidado no Eva Hub use a EVA pelo WhatsApp:
1. cadastre o telefone dele dentro da área do Hub,
2. escolha qual "dono" (workspace) está ativo via comando no WhatsApp,
3. e que TODA ação respeite o papel (viewer/editor/admin) e os recursos liberados (empresas, contas, cartões, maquininhas, carteiras).

---

## 1. Cadastro do telefone (UI)

Adicionar uma nova seção **"Meu WhatsApp"** na visão do Hub para o membro logado, em `src/pages/hub/` (provavelmente uma nova rota `HubMeuWhatsApp.tsx` acessível só por quem é `isHubMember`).

- Campo de telefone com máscara BR, salvo no `profiles.whatsapp_number` do próprio membro (mesmo campo já existente).
- Aviso explicativo: "Este é o número que a EVA vai reconhecer. Você terá acesso aos workspaces onde foi convidado e poderá alternar entre eles por comando."
- Lista dos donos/workspaces aos quais o membro pertence (via `workspace_members`), mostrando qual está marcado como **ativo no WhatsApp**.
- Botão "Definir como ativo" em cada workspace (atalho para não depender só do comando no WA).

Donos continuam usando `/configuracoes` normalmente — sem mudança para eles.

## 2. Estado "workspace ativo no WhatsApp"

Nova tabela `whatsapp_active_owner` para persistir, por membro, qual dono está ativo no momento (única fonte de verdade que o webhook consulta).

```
whatsapp_active_owner
- member_user_id (uuid, PK, FK → auth.users)
- active_owner_id (uuid, FK → auth.users)  -- pode ser o próprio member_user_id (conta pessoal dele)
- updated_at
```

RLS: membro só lê/escreve a própria linha. Edge function escreve via service role.

## 3. Resolução no webhook (`whatsapp-webhook`)

Após resolver o `profile` pelo telefone (passo 3 atual do arquivo), inserir nova etapa:

1. Buscar `workspace_members` onde `member_user_id = profile.id` e `status = 'active'` → lista de donos disponíveis.
2. Decidir `effectiveOwnerId`:
   - Se NÃO é membro de nenhum hub → `effectiveOwnerId = profile.id` (comportamento atual, sem mudanças).
   - Se é membro de 1+ hubs → ler `whatsapp_active_owner.active_owner_id`. Se não houver registro, primeira interação responde com lista numerada ("Você tem acesso a: 1) Clínica X, 2) Empresa Y, 3) Minha conta pessoal. Responda com o número para escolher") e grava a escolha.
3. **Comandos de troca**: detectar mensagens como `usar Clínica X`, `trocar workspace`, `meus workspaces`, `workspace atual` antes de cair na IA. Atualiza `whatsapp_active_owner`.
4. Daqui em diante, **todas** as queries e inserts da função usam `effectiveOwnerId` no lugar de `profile.id`:
   - leitura de contas, cartões, categorias, contatos, lançamentos;
   - escrita: `transactions.user_id = effectiveOwnerId` (e nunca o id do membro);
   - quotas de IA (`ai_usage_counters`) continuam contadas no dono (consistente com cobrança do plano).
5. Para auditoria, gravar `created_by_user_id = profile.id` em `transactions` (ver passo 5).

## 4. Permissões (papel + escopo)

Antes de qualquer ação de escrita, validar contra `workspace_members` + `workspace_member_permissions`:

- **Viewer**: só `listar_lancamentos` / consultas. Qualquer pedido de criar/editar/excluir responde "Você tem permissão apenas de leitura neste workspace."
- **Editor / Admin**: pode criar/editar/excluir.
- **Escopo de recursos**: ao montar a lista de contas/cartões/maquininhas/carteiras que o prompt da IA recebe, filtrar pelas linhas presentes em `workspace_member_permissions` (quando existirem). Reutilizar a função existente `hub_member_can_see`.
- Se a IA propuser usar uma conta/cartão fora do escopo, recusar e pedir para escolher dentro da lista permitida.

Aplicar o mesmo filtro nas leituras (consultas históricas, busca de fornecedores, etc.).

## 5. Auditoria

Adicionar coluna `created_by_user_id uuid` em `transactions` (nullable, default null para retrocompat). Webhook sempre preenche com `profile.id` (o membro real que mandou a mensagem) quando `profile.id != effectiveOwnerId`. UI do dono pode futuramente mostrar "criado por Fulano via WhatsApp".

## 6. Eva Chat in-app

A `eva-chat` já roda dentro do contexto de impersonação do Hub (já usa o `HubContext`), então **não precisa de mudança** — o dono ativo lá é definido pela impersonação visual. Só validar que o `userId` usado na função é o do dono impersonado, não o do membro (deve já estar correto, mas confirmo no momento da implementação).

---

## Detalhes técnicos

**Arquivos a criar/editar**
- Migração:
  - `CREATE TABLE public.whatsapp_active_owner` + GRANTs + RLS + policies + trigger updated_at.
  - `ALTER TABLE public.transactions ADD COLUMN created_by_user_id uuid NULL`.
- `src/pages/hub/HubMeuWhatsApp.tsx` (nova página).
- `src/components/layout/HubLayout.tsx` (link no menu do Hub para membros).
- `src/App.tsx` (rota nova).
- `supabase/functions/whatsapp-webhook/index.ts`:
  - bloco de resolução de `effectiveOwnerId` logo após linha ~663;
  - parser de comandos de workspace (`usar`, `trocar workspace`, `meus workspaces`, `workspace atual`);
  - substituir `userId` por `effectiveOwnerId` em TODAS as queries de dados;
  - validação de role/escopo antes de qualquer write;
  - gravar `created_by_user_id` no insert de `transactions`.
- `supabase/functions/_shared/` (opcional): util `resolveHubContext.ts` para o webhook.

**Comandos do WhatsApp reconhecidos**
- `meus workspaces` → lista numerada.
- `usar <nome>` ou número da lista → grava em `whatsapp_active_owner`.
- `workspace atual` → mostra o ativo.
- `sair do workspace` → volta para a conta pessoal (`active_owner_id = profile.id`).

**Fallback de primeira mensagem**: se for membro de algum hub e ainda não escolheu, EVA responde com a lista antes de processar qualquer comando financeiro.

**Comportamento para quem NÃO é membro de hub**: zero mudança. Continua usando `profile.id` direto.

---

## Fora de escopo
- Cadastro do telefone do membro pelo dono no modal de convite (descartado em favor da seção no Hub).
- WhatsApp do chat in-app (já resolvido pela impersonação).
- Notificações push para o membro quando o dono mudar permissões.
