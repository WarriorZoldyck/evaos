

## Plano: Corrigir EVA Chat In-App para usar staging area (ai_pending_transactions)

### Problema

A edge function `eva-chat` insere lançamentos diretamente na tabela `transactions`, pulando a etapa de revisão em `ai_pending_transactions`. Isso faz com que lançamentos criados pelo chat in-app não passem pela aprovação no "Análises EVA", ao contrário do fluxo via WhatsApp que funciona corretamente. As mensagens de retorno também são enganosas ("✅ Criado!") quando deveriam indicar que o lançamento foi para aprovação.

### Mudanças em `supabase/functions/eva-chat/index.ts`

**1. Parcelas (linhas ~525-567)** — trocar `supabase.from("transactions").insert(...)` por `supabase.from("ai_pending_transactions").insert(...)`:
- Adicionar campos obrigatórios: `source: "in_app"`, `status: "pending"`, `fingerprint`, `ai_response_message`, `original_message`
- Mapear `status` para `transaction_status` (campo da tabela pending)
- Gerar `series_id` e incluir `installment_number`, `installments_total`
- Alterar resposta de "✅ X parcelas criadas!" para "📋 X parcelas enviadas para aprovação!"

**2. Transação simples (linhas ~570-607)** — mesma troca:
- Inserir em `ai_pending_transactions` com `source: "in_app"`, `status: "pending"`, `fingerprint`
- Mapear `status` para `transaction_status`
- Alterar resposta de "✅ Lançamento criado!" para "📋 Lançamento enviado para aprovação!"
- Adicionar fingerprint e detecção de duplicatas (reutilizar lógica similar ao WhatsApp)

**3. Action labels** — trocar `action: "created_transaction"` / `"created_installments"` por `"pending_approval"` para que o frontend saiba que não é definitivo

### Arquivo afetado
- `supabase/functions/eva-chat/index.ts`

### Resultado esperado
Lançamentos via chat in-app vão para "Análises EVA" para revisão, igual ao WhatsApp. O usuário recebe feedback claro de que precisa aprovar no app.

