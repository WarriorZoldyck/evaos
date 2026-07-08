## Problema

No lançamento por maquininha (cartão de crédito), a **prévia** dentro do modal mostra a data de recebimento correta (ex.: competência 20/06 + D+30 = **20/07**), mas depois que o lançamento é criado a data de pagamento salva vem diferente (ex.: **31/07**).

## Causa

Existe uma inconsistência entre "dias corridos" e "dias úteis" na hora de calcular D+X:

- **Prévia dentro do formulário** (`TransactionFormModal.tsx` linha 1785-1787):
  - Débito → `addBusinessDays` (dias úteis)
  - Crédito → `addDays` (dias corridos) ← o que aparece na tela
- **Ao salvar** (`TransactionFormModal.tsx` linhas 578 e 644, tanto o fluxo à vista quanto o D+30 antecipado de parcelado):
  - Débito e Crédito → **ambos** `addBusinessDays` (dias úteis)

Ou seja: para crédito, a prévia usa calendário mas o save usa dias úteis. D+30 em dias úteis "empurra" ~11 dias a mais (fins de semana), gerando exatamente o comportamento reportado (20/06 → 31/07).

Os outros lugares que exibem a data de liquidação (`MdrInfoCard`, `TransactionDetailModal`) também usam `addBusinessDays` para crédito, então mostram a data "errada" (a mesma que foi salva), reforçando a confusão.

## Convenção adotada

Padronizar para o comportamento que o usuário vê na prévia e que é o padrão de mercado no Brasil para maquininhas:

- **Cartão de Crédito** (à vista e parcelado antecipado) → **dias corridos** (`addDays`)
- **Cartão de Débito** → **dias úteis** (`addBusinessDays`)

## Alterações

1. **`src/components/lancamentos/TransactionFormModal.tsx`**
   - Linha 574-578 (fluxo genérico de terminal): calcular `finalPaymentDate` com `addDays` quando crédito e `addBusinessDays` quando débito.
   - Linha 644 (crédito parcelado com antecipação/lump sum D+X): trocar `addBusinessDays` por `addDays`.
   - Sem mudança no bloco da prévia (linhas 1785-1787), que já está no padrão correto.

2. **`src/components/lancamentos/MdrInfoCard.tsx`** (linhas 74 e 133)
   - Usar `addDays` para crédito, manter `addBusinessDays` para débito, mantendo consistência com o novo padrão.

3. **`src/components/lancamentos/TransactionDetailModal.tsx`** (linha 142)
   - Mesma regra: `addDays` para crédito, `addBusinessDays` para débito. Detectar débito/crédito via `payment_method` da transação já carregada.

## Fora de escopo

- Não altero `addBusinessDays` em si — outros lugares (débito, cálculos que realmente precisam de dias úteis) continuam usando.
- Não altero transações antigas já gravadas com a data errada. Se o usuário quiser reprocessar históricos, podemos fazer um script service-role em uma tarefa separada.
- Regras de crédito parcelado sem antecipação (cada parcela em +1 mês) continuam iguais — já usam `addMonths` e não têm o bug.
