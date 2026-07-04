## Diagnóstico (logs de espclin@hotmail.com)

**Fluxo real registrado hoje:**
1. `12:34` — Foto do comprovante Aramis R$ 628,85 → EVA criou lançamento pendente único (aprovado depois).
2. `12:55` — Usuário mandou "Parcelado em 5x" (com foto). Gemini classificou como `editar_lancamento` com `field=installments, new_value=5`, mas nosso guard-rail derrubou por não ter verbo de edição → respondeu como conversa.
3. `12:57` — Reenviou com imagem. Gemini classificou como `criar_lancamento` mas retornou `installments=5, installment_details=null`. O código só entra na rotina de parcelas quando existe `installment_details` — resultado: inseriu **1 pendente único** (R$ 628,83, `installments=1`), mesmo com a mensagem amigável dizendo "parcelada em 5 vezes".

**Em Análises EVA:** editar um pendente único e transformar em parcelado não faz nada — o handler `handlePendingUpdate` só faz `UPDATE` de uma linha; nunca cria a série.

## O que muda

### 1. `supabase/functions/whatsapp-webhook/index.ts` — parcelamento no WhatsApp

**a) EDIT_VERB_RE:** incluir `parcela`, `parcelado`, `parcelar`, `parcelamento`, `parcele`, `em Nx`, `N vezes` como gatilhos válidos de edição (para não cair mais na conversa quando o usuário só diz "Parcelado em 5x").

**b) Branch `editar_lancamento` com `field ∈ { installments, parcelas }`:** novo caminho dedicado:
   - resolver o alvo: `transaction_id` explícito → senão pega o pendente mais recente do usuário/contexto (últimos 30 min) → senão a `transaction` mais recente.
   - se o alvo é um pendente único: dividir `amount` em N parcelas iguais (resto na última), calcular `payment_date` de cada parcela via `getInstallmentDueDate` quando houver `credit_card_id`, senão `+1 mês` incremental. `DELETE` do pendente original, `INSERT` de N linhas com o mesmo `series_id`, `installment_number`, `installments_total=N`.
   - se o alvo já é uma transação aprovada (`transactions`): aplicar mesma lógica na tabela `transactions` (delete + insert série) preservando `series_id`.
   - responder com o mesmo formato de parcelas do bloco de criação (`📋 5 parcelas atualizadas...`).

**c) Branch `criar_lancamento`:** quando `installments > 1` e `installment_details` está vazio, gerar `installment_details` automaticamente (split + datas por ciclo de cartão / mensal) **antes** do `if (installmentCount > 1 && installmentDetails)`. Isso corrige o caso em que a IA reconhece "5x" mas não devolve o array.

### 2. `src/pages/AnalisesEva.tsx` + `src/hooks/useAIPendingTransactions.ts` — edição do pendente

**a) `handlePendingUpdate`** passa a receber também os campos `is_installment`, `installments_count`, `installment_interval_type`, `installment_custom_days`, `first_installment_amount` do form (via segundo argumento opcional). Quando `is_installment=true`:
   - divide `amount` em N (resto na última, respeitando `first_installment_amount` se preenchido).
   - calcula datas por ciclo de cartão (`credit_card_id`) ou intervalo escolhido.
   - `DELETE` da linha atual em `ai_pending_transactions` e `INSERT` das N novas com mesmo `series_id`, `installment_number`, `installments_total`, herdando os demais campos editados.
   - se `is_installment=false` mantém o comportamento atual (update simples).

**b) Novo helper `convertPendingToSeriesAsync` no hook `useAIPendingTransactions` para encapsular delete+insert numa única mutação com `invalidateAll()`.

**c) Ampliar o payload de `updates`** para também gravar `installments`, `installments_total`, `series_id`, `installment_number` (hoje não são atualizados — perde-se informação).

**d) Fallback de datas nulas** no `TransactionFormModal` (linhas 411-412): se `payment_date`/`competence_date` vierem `null` do pendente, cair para `new Date()` em vez de `new Date("nullT00:00:00")` (Invalid Date silencioso).

## Escopo

- **Não retroativo.** Pendentes/transações já existentes não são reconvertidos.
- Sem mexer em DRE, hooks financeiros, fluxo de aprovação, ou base de dados (nenhuma migration).
- Fluxo de criação normal permanece igual quando não há parcelamento envolvido.
- Não altero a página "Lançamentos" (já ajustada anteriormente).

## Como validar

1. WhatsApp: mandar foto de compra + caption "Parcelado em 5x" → deve criar 5 pendentes com `series_id` e resposta "📋 5 parcelas enviadas para aprovação".
2. WhatsApp: após criar um lançamento simples, responder "parcelar em 3x" → deve converter em 3 pendentes.
3. Análises EVA: abrir um pendente único, marcar "Parcelado?" com 4x, salvar → deve virar 4 cards na área de série.
