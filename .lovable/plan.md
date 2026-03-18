

## Habilitar Renomear, Mover e Excluir Categorias via WhatsApp

### Situação Atual
A EVA só suporta `criar` e `criar_subcategoria`. As ações de renomear, mover e excluir estão explicitamente bloqueadas no system prompt (linha 875-877) e no handler (linhas 1780-1785), que redireciona o usuário para o painel web.

### Plano

**1. Atualizar o System Prompt** (linhas ~868-878)
- Adicionar as ações `renomear`, `mover` e `excluir` ao formato JSON de `gerenciar_categoria`
- Remover a instrução que proíbe essas ações
- Adicionar regras:
  - `renomear`: requer `category_id` + `new_name`
  - `mover`: requer `category_id` + `new_parent_category_id` (ou null para tornar raiz)
  - `excluir`: requer `category_id`. A IA deve avisar que subcategorias precisam ser excluídas antes
- Adicionar instrução para a IA **confirmar** ações destrutivas (excluir) com o usuário antes de executar — usando o sistema de pending_actions

**2. Estender o handler `gerenciar_categoria`** (linhas ~1700-1785)

- **Renomear**: `supabase.from("categories").update({ name }).eq("id", id).eq("user_id", userId)`
- **Mover**: `supabase.from("categories").update({ parent_id }).eq("id", id).eq("user_id", userId)` — validar que o destino existe e não cria ciclo
- **Excluir**: Criar pending_action `delete_category` com confirmação. No handler de confirmação, verificar se tem filhos antes de excluir

**3. Adicionar pending action para exclusão** (na seção de pending actions, ~linhas 370-695)
- Novo `action_type: "delete_category"` — ao confirmar, verifica filhos e deleta

### Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts`

