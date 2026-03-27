

# Revisão do Sistema de Duplicatas — Correções

## Problemas Encontrados

### 1. Duplicate suspects "órfãos" ficam invisíveis
Se o usuário envia 2 lançamentos iguais, o 2o vira `duplicate_suspect`. Se o 1o (status `pending`) for aprovado antes do usuário resolver a duplicata, o suspect perde seu par no clustering (linha 213 do hook agrupa por amount+description+date e precisa de length > 1). Resultado: o suspect fica preso — não aparece em Pendentes, nem em Duplicatas, nem em Histórico.

**Correção**: Duplicate suspects sem par devem aparecer como cluster de 1 na aba Duplicatas, com opção de "Manter" (mover para pending) ou "Rejeitar".

### 2. Normalização inconsistente entre webhook e hook
O webhook normaliza a descrição com `toLowerCase().replace(/\s+/g, " ").trim()` antes de gerar o SHA-256. O hook (client-side) agrupa por `toLowerCase().trim()` sem colapsar espaços múltiplos. Isso pode causar clusters que não se juntam corretamente.

**Correção**: Usar mesma normalização no hook.

### 3. Query filtra por company_id — suspects de outro contexto ficam ocultos
A query principal filtra por `company_id`. Se o lançamento original foi de contexto pessoal e o duplicado foi de empresa (ou vice-versa), o suspect nunca aparece na mesma tela.

**Correção**: Na aba Duplicatas, buscar suspects de TODOS os contextos do usuário (sem filtro de company_id), para não perder duplicatas cross-company.

### 4. Series são ignoradas no fingerprint mas podem duplicar
`checkAndSetDuplicateStatus` retorna "pending" para séries (isSeries = true). Se o usuário envia a mesma compra parcelada 2x, ambas entram como pending sem aviso.

**Correção**: Para séries, gerar fingerprint baseado na descrição + amount total + competence_date da 1a parcela, e verificar se já existe série pendente com mesmo fingerprint.

## Etapas

### 1. Hook — corrigir clustering e normalização
**Arquivo**: `src/hooks/useAIPendingTransactions.ts`
- Normalizar descrição com `.replace(/\s+/g, " ")` antes de montar a key
- Suspects sem par (órfãos) devem formar cluster de 1 com ações de "Manter" ou "Rejeitar"
- Adicionar query separada para suspects sem filtro de company_id

### 2. UI — tratar clusters de 1 item (suspect órfão)
**Arquivo**: `src/pages/AnalisesEva.tsx`
- Cluster com 1 item: mostrar card simplificado com "Manter como pendente" e "Rejeitar"
- Cluster com 2+: manter UI atual com "Manter este"

### 3. Webhook — habilitar detecção de séries duplicadas
**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`
- Em vez de `if (isSeries) return "pending"`, gerar fingerprint da série (description + total amount + 1a competence_date)
- Verificar se já existe série pendente com esse fingerprint
- Se sim, marcar todas as parcelas da nova série como `duplicate_suspect`

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useAIPendingTransactions.ts` | Normalização, orphan suspects, query cross-company |
| `src/pages/AnalisesEva.tsx` | UI para clusters órfãos |
| `supabase/functions/whatsapp-webhook/index.ts` | Detecção de séries duplicadas |

