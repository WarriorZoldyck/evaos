## Objetivo
Mostrar, no seletor de contexto do sidebar, a quantidade de lançamentos pendentes em **Análises EVA** por contexto — para que o usuário identifique rapidamente onde há itens a revisar sem precisar entrar e trocar de contexto.

## Como vai ficar
No dropdown atual "Todas as contas / Pessoal / [Empresas]", cada linha ganha um badge numérico à direita quando houver pendências:

```text
[Layers]  Todas as contas              (7)
─────────────────────────────────────────
[☐] [User]      Pessoal                (2)
[☑] [Building]  EVA OS                 (3)
[☐] [Building]  IMPLANTES BR LTDA      (2)
[☐] [Building]  RENATO BRUGGEMANN
```

- Badge só aparece quando `count > 0`.
- Estilo: pill pequeno em `bg-primary/15 text-primary`, consistente com o "3 pendentes" já usado em Análises EVA.
- "Todas as contas" mostra o total somado.
- Opcional (leve): mostrar um pontinho indicador no botão-trigger do seletor quando o total > 0 e o contexto atualmente selecionado não cobre todas as pendências (ex: usuário está em "Pessoal" mas há pendências em "EVA OS").

## Fonte de dados
Query única scoped por `user_id`:

```sql
select company_id, count(*)
from ai_pending_transactions
where user_id = auth.uid() and status = 'pending'
group by company_id;
```

- `company_id IS NULL` → Pessoal.
- Demais IDs mapeiam para o nome via `companies`.

## Implementação técnica
1. Novo hook `src/hooks/usePendingAnalisesCountByContext.ts`
   - Usa React Query, key `["pending-analises-by-context", userId]`.
   - Retorna `{ personal: number, byCompanyId: Record<string, number>, total: number }`.
   - `staleTime: 30s`; invalidado quando pendentes mudam (reaproveitar invalidação já existente em Análises EVA — adicionar `queryClient.invalidateQueries({ queryKey: ["pending-analises-by-context"] })` nos pontos que hoje invalidam a lista pendente).
2. `src/components/layout/AppSidebar.tsx`
   - Consumir o hook.
   - Adicionar `<span>` de badge ao final de cada `DropdownMenuItem` (Todas / Pessoal / cada empresa) quando count > 0.
   - Ajustar layout: `flex items-center` no item + `ml-auto` no badge (respeitando o `Check` de "Todas as contas" — mover o Check para antes do badge ou empilhar ambos com gap).
   - (Opcional) Pequeno dot `bg-primary` no trigger quando houver pendências fora do contexto atualmente ativo.
3. Sem mudanças em `src/pages/AnalisesEva.tsx` além da invalidação do novo query key após aprovar/rejeitar.

## Fora de escopo
- Não alterar o header da página Análises EVA.
- Não adicionar badges nos cards individuais.
- Não mudar a lógica de filtragem por contexto — apenas exibir contadores.