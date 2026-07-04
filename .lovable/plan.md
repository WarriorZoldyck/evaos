## Ajustes na edição de lançamentos parcelados (Análises EVA)

### Problema 1 — Edição abre a parcela, não o lançamento inteiro
Hoje, ao clicar em "Editar" numa parcela dentro de uma série na página Análises EVA, o modal abre com os dados daquela parcela específica (ex.: "Compra na Aramis (1/5)", R$ 125,76). O correto é o usuário poder escolher entre editar a série inteira ou apenas aquela parcela.

**Solução:**
1. Antes de abrir o modal, quando o item clicado pertence a uma série (`series_id` presente e `installments_total > 1`), abrir um pequeno `AlertDialog` de escolha com duas opções:
   - **"Editar lançamento inteiro"** (padrão) — carrega a série consolidada.
   - **"Editar apenas esta parcela"** — comportamento atual.
2. Quando o usuário escolher "lançamento inteiro":
   - Montar um `Transaction` sintético agregando todas as parcelas da série:
     - `amount` = soma de todas as parcelas (valor total original).
     - `description` = descrição base sem o sufixo `(x/N)`.
     - `competence_date` = da primeira parcela.
     - `payment_date` = da primeira parcela.
     - `installments` = N; `installment_number` = null; `series_id` mantido.
     - Demais campos (categoria, conta/cartão, contato, notas, anexo, etc.) herdados da primeira parcela.
   - Passar uma flag interna (`__editingSeries: true`) no `editingItem`.
3. Ao salvar (`handlePendingUpdate`):
   - Se estava editando a série inteira, **regenerar todas as N parcelas**: `DELETE` todas as linhas com aquele `series_id` e `INSERT` N novas com o novo valor total dividido, novas datas (recalculadas a partir da nova data base, com a mesma lógica de ciclo de cartão / mensal / dias customizados já existente), nova descrição base, categoria, conta, etc. `series_id` reaproveitado.
   - Se estava editando apenas uma parcela, mantém fluxo atual (UPDATE simples da linha).
4. Se a série tiver apenas 1 parcela restante (`items.length === 1`), pular o AlertDialog e ir direto à edição do item.

### Problema 2 — Cartão não aparece na 1ª abertura do modal
O `key={editTransaction?.id ?? "new"}` no `DialogContent` desmonta o conteúdo corretamente, mas o `Select` de conta/cartão tem um `useEffect` que resolve o valor após o `context` (Pessoal/Empresa) chegar, o que só acontece depois do primeiro paint. Na segunda abertura o valor já está em cache.

**Solução:**
1. Em `TransactionFormModal`, quando `open` passa a `true` e `editTransaction` já traz `credit_card_id`/`bank_account_id`/`wallet_id`, definir o valor do combobox de conta **imediatamente no `form.reset(...)`** (síncrono), sem depender do `useEffect` que só dispara após `context` estar disponível.
2. Alternativamente, se o resolvedor de contexto for necessário, forçar `context` inicial derivando de `editTransaction.company_id` (se houver) ou "Pessoal" no próprio `defaultValues` do `useForm`, para o primeiro render já ter o valor certo.

### Arquivos afetados
- `src/pages/AnalisesEva.tsx` — novo AlertDialog de escolha, agregação da série, adaptação de `handlePendingUpdate` para regenerar N parcelas quando `__editingSeries`.
- `src/components/lancamentos/TransactionFormModal.tsx` — pré-preencher conta/cartão no `form.reset` inicial para eliminar o "carregamento" na primeira abertura.

### Fora de escopo
- Fluxo do WhatsApp e criação de lançamentos (já funcionando).
- Edição em `/lancamentos` (já resolvida em interações anteriores).
- Mudanças de schema, DRE, aprovação, ou lógica financeira.