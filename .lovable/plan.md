

# Detecção de Duplicatas nos Lançamentos da IA

## Situação Atual

Hoje a detecção de duplicatas existe **apenas na importação de extratos** — via `external_id` único gerado a partir da descrição normalizada. Para lançamentos via WhatsApp/IA, **não existe nenhuma proteção contra duplicatas**. Se o usuário enviar a mesma nota fiscal duas vezes, a IA cria dois registros independentes na `ai_pending_transactions`.

## Proposta

### 1. Nova aba "Duplicatas" na página Análises EVA

Adicionar uma terceira aba ao `TabsList` existente (Pendentes | Revisados | **Duplicatas**). Essa aba mostra grupos de lançamentos com suspeita de duplicação, permitindo ao usuário manter um e rejeitar os demais.

### 2. Algoritmo de detecção (client-side, sobre os pendentes)

Critérios para considerar duplicata — lançamentos que compartilhem **pelo menos 2 de 3**:
- Mesmo `amount` (valor exato)
- Descrição similar (normalizada: lowercase, sem espaços extras, similaridade > 80% ou mesma substring principal)
- Mesma `competence_date` ou `payment_date`

Agrupados visualmente como clusters. Cada cluster mostra os lançamentos lado a lado com destaque nas diferenças.

### 3. Ações por cluster

- **Manter este** — aprova um e rejeita os demais do grupo
- **Manter todos** — marca como "não duplicata" (descarta o alerta)
- **Rejeitar todos** — rejeita o grupo inteiro

### 4. Hash de fingerprint no webhook (prevenção futura)

No `whatsapp-webhook`, ao inserir na `ai_pending_transactions`, gerar um campo `fingerprint` (hash de `amount + description_normalizada + competence_date`). Isso permite detecção server-side mais precisa e evita que a mesma nota fiscal gere dois registros.

## Etapas de implementação

### Etapa 1 — Migration: adicionar coluna `fingerprint`
```sql
ALTER TABLE ai_pending_transactions 
  ADD COLUMN fingerprint text;
CREATE INDEX idx_ai_pending_fingerprint 
  ON ai_pending_transactions(user_id, fingerprint) 
  WHERE status = 'pending';
```

### Etapa 2 — Webhook: gerar fingerprint ao inserir
No `whatsapp-webhook`, antes de inserir na `ai_pending_transactions`, calcular:
```
fingerprint = SHA256(amount + "|" + normalize(description) + "|" + competence_date)
```
Se já existir um pending com mesmo `user_id` + `fingerprint`, marcar o novo como `status = 'duplicate_suspect'` em vez de `'pending'`.

### Etapa 3 — Hook: expor duplicatas
No `useAIPendingTransactions`, adicionar filtro para `status = 'duplicate_suspect'` e uma query que agrupa pendentes por fingerprint (onde count > 1).

### Etapa 4 — UI: aba Duplicatas em AnalisesEva.tsx
- Nova aba com clusters de duplicatas
- Cada cluster mostra os lançamentos suspeitos lado a lado
- Botões: "Manter este", "Manter todos", "Rejeitar duplicatas"

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar coluna `fingerprint` + índice |
| `supabase/functions/whatsapp-webhook/index.ts` | Gerar fingerprint, detectar duplicata ao inserir |
| `src/hooks/useAIPendingTransactions.ts` | Expor lista de duplicatas agrupadas |
| `src/pages/AnalisesEva.tsx` | Nova aba "Duplicatas" com clusters e ações |

