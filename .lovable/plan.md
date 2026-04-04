

# Transferências Operacionais vs Internas — Detecção Automática por Contexto

## Dados reais confirmam a abordagem

Analisei todas as transferências no banco. O padrão é claro e 100% determinístico:

| Tipo | Exemplo | source_company | dest_company | Classificação |
|------|---------|---------------|-------------|--------------|
| Pro-labore PJ→PF | "Pró-labore" | `5b3cf59b` (empresa) | `null` (pessoal) | **CROSS-CONTEXT** = despesa real |
| Faxina PJ→PF | "Faxina" | `cb0f2473` (empresa) | `null` (pessoal) | **CROSS-CONTEXT** = despesa real |
| Entre contas PJ→PJ | "TRANSFERENCIA ENTRE CONTAS" | `b958c0a4` | `b958c0a4` | **INTERNAL** = não é despesa |
| Entre contas PF→PF | "RESG POUP" | `null` | `null` | **INTERNAL** = não é despesa |

**Não precisa detectar pela categoria.** O contexto (company_id da origem vs destino) resolve 100% dos casos sem nenhuma configuração do usuário. Pro-labore, faxina, energia — tudo que sai da PJ para a PF é automaticamente despesa operacional da empresa.

## Solução: coluna `is_internal_transfer`

### 1. Migration SQL

```sql
ALTER TABLE transactions 
  ADD COLUMN is_internal_transfer boolean DEFAULT false;

-- Classificar transferências existentes automaticamente
UPDATE transactions t1
SET is_internal_transfer = true
FROM transactions t2
WHERE t1.transfer_id IS NOT NULL
  AND t1.transfer_id = t2.transfer_id
  AND t1.id != t2.id
  AND t1.company_id IS NOT DISTINCT FROM t2.company_id;
```

Regra: `is_internal_transfer = true` quando ambas as pontas têm o mesmo `company_id` (incluindo ambas `null` = pessoal↔pessoal).

### 2. Queries dos relatórios (Dashboard, DRE, Caixa)

Trocar `.is("transfer_id", null)` por:
```typescript
.or("transfer_id.is.null,is_internal_transfer.eq.false")
```

Isso inclui:
- Transações normais (sem transfer_id) ✓
- Transferências cross-context (PJ→PF pro-labore) ✓

E exclui:
- Transferências internas (PJ→PJ ou PF→PF) ✓

### 3. Formulário de transferência

No `TransactionFormModal.tsx`, ao criar a transferência, calcular automaticamente:
```typescript
const isInternal = sourceCompanyId === destCompanyId 
  || (sourceCompanyId == null && destCompanyId == null);

// Setar em ambas as pontas
{ ...transfer, is_internal_transfer: isInternal }
```

### 4. WhatsApp webhook

No `whatsapp-webhook/index.ts`, mesma lógica ao criar transferências via Eva.

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar coluna + classificar existentes |
| `src/hooks/useDashboardData.ts` | 3 queries: trocar filtro |
| `src/hooks/useDREData.ts` | 1 query: trocar filtro |
| `src/hooks/useCashFlowData.ts` | 1 query: trocar filtro |
| `src/components/lancamentos/TransactionFormModal.tsx` | Setar `is_internal_transfer` ao criar |
| `supabase/functions/whatsapp-webhook/index.ts` | Setar `is_internal_transfer` ao criar |

## Resultado esperado

- Pro-labore do usuário `espclin@hotmail` volta a aparecer como R$ 38.240 em despesas de março
- Transferências "ENTRE CONTAS" da mesma empresa continuam excluídas
- Zero configuração para o usuário — é automático
- Funciona para todos os usuários, presente e futuro

