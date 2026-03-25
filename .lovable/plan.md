

# Corrigir Duplicação na Importação de Extrato

## Problema
A importação de extratos não verifica se transações com o mesmo `external_id` já existem no banco. Quando o usuário importa o mesmo extrato duas vezes, as transações são duplicadas (ex: IOF R$7,70 e R$101,31 aparecendo 2x).

Além disso, não há constraint de unicidade no campo `external_id` na tabela `transactions`.

## Correções

### 1. Migration: Unique constraint no `external_id`
- Adicionar um índice único parcial: `CREATE UNIQUE INDEX ON transactions (external_id) WHERE external_id IS NOT NULL`
- Isso impede duplicatas no nível do banco

### 2. `createMultipleTransactions` — verificação pré-insert
- Antes do insert, buscar todos `external_id`s existentes do usuário que coincidam com os da importação
- Filtrar do array as transações cujo `external_id` já existe
- Se todas já existirem, avisar "Todas as transações já foram importadas anteriormente"
- Se algumas já existirem, avisar quantas foram ignoradas por duplicidade

### 3. `external_id` mais robusto
- Usar `description.slice(0, 50)` em vez de `slice(0, 20)` para diferenciar melhor transações com descrições similares (ex: "IOF ADICIONAL - AUTOMATICO" vs "IOF IMPOSTO OPERACOES")
- Normalizar o external_id removendo espaços extras

## Arquivos afetados
| Arquivo | Ação |
|---------|------|
| `supabase/migrations/` | Nova migration — unique index parcial em `external_id` |
| `src/hooks/useTransactions.ts` | Editar `createMultipleTransactions` — dedup pré-insert |
| `src/components/lancamentos/ImportStatementModal.tsx` | Editar — `external_id` com slice maior |

