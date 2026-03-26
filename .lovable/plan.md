

# Análises EVA — Caixa de Entrada de Lançamentos da IA

## Conceito
Nova página "Análises EVA" no menu lateral onde todos os lançamentos gerados via WhatsApp (e futuramente e-mail) caem para aprovação do usuário antes de irem para o sistema. A IA do WhatsApp para de inserir direto na `transactions` e passa a inserir numa tabela staging `ai_pending_transactions`.

## Etapas

### 1. Migration: tabela `ai_pending_transactions`
Campos espelhando `transactions` + metadados:
- `source` (whatsapp/email/upload), `status` (pending/approved/rejected)
- `confidence_score`, `ai_response_message`, `original_message`
- `reviewed_at`
- RLS: `user_id = auth.uid()`

### 2. Webhook WhatsApp → redirecionar inserts
Todos os `supabase.from("transactions").insert(...)` no `whatsapp-webhook/index.ts` passam a inserir em `ai_pending_transactions` com `status: 'pending'` e `source: 'whatsapp'`. A mensagem de confirmação muda para "Lançamento enviado para aprovação no app".

### 3. Hook: `src/hooks/useAIPendingTransactions.ts`
- `fetchPending()` — lista pendentes
- `approveTransaction(id)` — copia para `transactions`, marca approved
- `rejectTransaction(id)` — marca rejected
- `pendingCount` — para badge no sidebar

### 4. Página: `src/pages/AnalisesEva.tsx`
Layout baseado na referência enviada:
- Header com título "Análises EVA" + badge de pendentes + botão "Enviar documento"
- Tabs: WhatsApp (com contador) | E-mail (em breve)
- Cards interativos mostrando: descrição, valor, tipo, categoria, fornecedor, data, conta, confiança da IA
- Botões por card: **Aprovar** (move para transactions), **Rejeitar**, **Visualizar** (attachment), **Editar** (abrir modal de edição antes de aprovar)

### 5. Sidebar + Rota
- Novo item "Análises EVA" com ícone `Sparkles` no grupo "Principal" do `AppSidebar.tsx`
- Badge dinâmico mostrando quantidade de pendentes
- Rota `/analises-eva` em `App.tsx`

### 6. Upload direto na página
Botão "Enviar documento" permite upload de imagem/PDF direto na página, chamando `eva-chat` para processar e inserindo em `ai_pending_transactions` com `source: 'upload'`.

## Arquivos afetados
| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `ai_pending_transactions` |
| `supabase/functions/whatsapp-webhook/index.ts` | Redirecionar ~5 inserts de `transactions` para `ai_pending_transactions` |
| `src/hooks/useAIPendingTransactions.ts` | Criar — CRUD + contagem |
| `src/pages/AnalisesEva.tsx` | Criar — página com cards de aprovação |
| `src/components/layout/AppSidebar.tsx` | Adicionar item com badge |
| `src/App.tsx` | Adicionar rota `/analises-eva` |

