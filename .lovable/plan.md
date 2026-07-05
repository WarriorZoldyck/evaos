
## Diagnóstico consolidado

| Sintoma | Causa real | Escopo |
|---|---|---|
| "Faturamento por competência não mostra tudo por contexto" | 942 tx (52%) com `company_id NULL` herdado de 5 contas bancárias sem contexto. Só aparecem em "Ver tudo" ou combinações que incluam Pessoal. | Sistêmico — afeta todos os relatórios |
| "Jane/Dejane aparece só quando junto Implantes + Renato" | A conta "Itaú Personnalite" está sem `company_id`. O usuário provavelmente quer atribuir a Renato. | Dados + UX |
| "Luiz competência 11/04 está errado" | Regra intencional: parcelas compartilham a competência da 1ª venda (`installment-accrual-logic`). A UI não deixa isso claro. | UX |
| "Lista do modal não mostra todos" | Paginação de 50 por página; controle de página não está óbvio. | UX |

## Correções (frontend + dados guiado pelo usuário — sem migration bruta)

### 1. Painel "Saúde de Dados" ganha 2 novos checadores

Em `src/pages/hub/HubIntegridade.tsx`:

**a) Contas bancárias sem contexto**
- Lista as 5 contas com `company_id IS NULL`, quantos lançamentos cada uma tem, e um seletor inline (`Pessoal` / lista de empresas) + botão "Atribuir e propagar".
- Ação executa `UPDATE bank_accounts SET company_id=X WHERE id=Y` **e** propaga: `UPDATE transactions SET company_id=X WHERE bank_account_id=Y AND company_id IS NULL`.
- Confirmação obrigatória mostrando quantas transações serão afetadas.

**b) Transações sem contexto cuja conta JÁ tem contexto**
- Já existe hoje (do painel anterior) — reforçar copy explicando que resolve o "sumiu do faturamento".

### 2. Trigger para não deixar reaparecer

Migration nova (`supabase/migrations/…`):

```sql
CREATE OR REPLACE FUNCTION public.inherit_company_from_account()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.bank_account_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER transactions_inherit_company
BEFORE INSERT OR UPDATE OF bank_account_id, company_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.inherit_company_from_account();
```

Efeito: qualquer novo lançamento herda o `company_id` da conta se não for informado explicitamente. Não sobrescreve `company_id` já preenchido.

### 3. Ajuste de UX no `FaturamentoDetailModal`

- **Cabeçalho auto-explicativo** (do plano anterior mantido): período ativo, contexto, contagem carregada, chips de filtros internos com "×".
- **Aba "Lista" com paginação visível**: substituir o `paginated.slice` silencioso por controles "◀ Página X de Y ▶" **e** um botão "Mostrar todos (N)" que expande o `PAGE_SIZE` para todos os itens filtrados. Se `N ≤ 200`, mostra tudo direto (sem paginar).
- **Alerta de contexto pendente**: se algum item carregado tem `company_id NULL` **ou** o filtro atual exclui itens desse tipo, mostrar um banner: "Existem X receitas sem contexto no período — abrir Saúde de Dados".
- **Etiqueta de parcelamento**: quando a linha é série (`isSeries`), o tooltip da competência mostra "Competência fixa da 1ª parcela — venda em DD/MM/AAAA. Cada parcela é paga em data diferente." Elimina a percepção de "competência errada" do Luiz.

### 4. `useTransactions` honra `dateField`

Aceitar `filters.dateField: "payment_date" | "competence_date"` (default `payment_date`). `TransactionFilters.tsx` e `Lancamentos.tsx` lêem `?dateField=` da URL. Fecha o loop do drill-down do modal.

## Detalhes técnicos

Arquivos afetados:
- `src/pages/hub/HubIntegridade.tsx` — 2 novos painéis + ações de propagação.
- `src/components/dashboard/FaturamentoDetailModal.tsx` — cabeçalho, paginação visível, alerta, tooltip de parcelas.
- `src/pages/Dashboard.tsx` — passar `onJumpToPeriod` (herdado do plano anterior).
- `src/hooks/useTransactions.ts`, `src/components/lancamentos/TransactionFilters.tsx`, `src/pages/Lancamentos.tsx` — suporte a `dateField`.
- `supabase/migrations/YYYYMMDD_inherit_company_from_account.sql` — trigger.

**Não faz parte deste plano:**
- Nenhum `UPDATE` em massa automático — a atribuição das 5 contas é feita pelo usuário no painel, um clique por conta, com preview de quantas transações serão afetadas. Preserva controle.
- Nenhuma mudança na regra de competência de parcelas (é design intencional).

## Aceite

1. `/eva-hub/integridade` lista as 5 contas sem contexto; ao atribuir "Itaú Personnalite" → Renato, X transações passam para Renato imediatamente.
2. Após reatribuir, o modal Faturamento com contexto Renato passa a listar as receitas antes órfãs (Dejane etc.).
3. Novo lançamento criado numa conta com contexto herda automaticamente (validar via inserção de teste).
4. Aba "Lista" do modal mostra "Página 1 de 3" ou "Mostrar todos (127)"; nenhuma linha fica escondida sem controle visível.
5. Linha de parcela mostra tooltip explicando competência fixa.
6. `/lancamentos?dateField=competence_date&dateFrom=…&dateTo=…` filtra por competência.
