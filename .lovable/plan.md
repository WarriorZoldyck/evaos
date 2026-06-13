# Reconciliação inteligente de boletos ao dar baixa

## Objetivo
Quando o usuário enviar um comprovante de pagamento de boleto pelo WhatsApp, a EVA deve verificar se aquele boleto **já existe como Pendente** no sistema. Se houver match forte, ela confirma com o usuário e dá baixa direta (status → Pago), sem criar duplicata em "Análises EVA".

## Fluxo proposto

```text
Usuário envia comprovante de pagamento
        │
        ▼
EVA extrai: fornecedor, valor, nome no boleto, data, código de barras
        │
        ▼
Busca em transactions (status=Pendente, mesmo owner/contexto, últimos 180 dias)
        │
        ├─ Match por código de barras → match definitivo (3/3)
        ├─ Senão, scoring por 3 critérios:
        │     1. Fornecedor (supplier_id igual OU nome ~ fuzzy ≥ 0.75)
        │     2. Valor (diferença ≤ R$ 0,02 OU ≤ 0,5%)
        │     3. Descrição/"nome registrado" (fuzzy ≥ 0.6 no description/notes)
        │
        ▼
Score ≥ 2/3?
        │
   ┌────┴─────┐
  Sim         Não
   │           │
   ▼           ▼
Pergunta:    Segue fluxo atual
"Encontrei   (cria em ai_pending_transactions
o boleto     como hoje)
X de R$ Y
lançado dia
Z para
[fornecedor].
É o mesmo?
[Sim] [Não]"
   │
   ├─ Sim → UPDATE transactions SET status='Pago',
   │         payment_date=<data comprovante>,
   │         bank_account_id/wallet_id=<conta usada>
   │         + anexa comprovante; SEM criar pending
   │
   └─ Não → segue fluxo normal (vai para Análises EVA)
```

## Mudanças

### 1. `supabase/functions/whatsapp-webhook/index.ts`
- Nova função `findMatchingPendingBoleto({ ownerId, contextCompanyId, supplierId, supplierName, amount, description, barcode, paymentMethod })`:
  - Busca em `transactions` com `status='Pendente'`, `type='despesa'`, mesmo owner/contexto, `payment_date` entre hoje−180d e hoje+30d.
  - Match imediato se `barcode` igual.
  - Caso contrário, calcula score 0–3 (fornecedor, valor, descrição). Retorna o melhor candidato com score ≥ 2 e diferença pequena de valor.
- Chamar essa função no ponto onde hoje insere em `ai_pending_transactions` para comprovantes de pagamento de boleto (intent=lancamento, type=despesa, payment_method=boleto/PIX/transferência com `status='Pago'`).
- Se houver candidato, ao invés de inserir pending:
  - Registrar uma `whatsapp_pending_actions` do tipo `confirm_boleto_match` com `{ transaction_id, comprovante_data }`.
  - Enviar mensagem: `"📄 Encontrei um boleto já lançado:\n\n• {description}\n• {supplier}\n• {fmt(amount)}\n• Vencimento {due_date}\n\nÉ o mesmo pagamento? Responda *Sim* para dar baixa ou *Não* para registrar como novo."`.

### 2. Handler da resposta
- Estender o handler de respostas a pending actions (já existe para outras confirmações) para o tipo `confirm_boleto_match`:
  - **Sim**: `UPDATE transactions SET status='Pago', payment_date=<data>, bank_account_id/wallet_id/credit_card_id=<resolvido>, notes = notes || '\n[Baixa via WhatsApp]'` na transação existente. Confirma ao usuário.
  - **Não**: prossegue inserindo a transação nova em `ai_pending_transactions` (fluxo atual).
  - Expiração de 10 min mantém o padrão atual.

### 3. Logs e memória
- Atualizar o registro `mem://whatsapp/intelligent-import` (ou criar `mem://whatsapp/boleto-reconciliation`) com as regras de scoring para futuras sessões.

## Detalhes técnicos

- **Fuzzy match**: similaridade simples por tokens normalizados (lowercase, sem acento, sem pontuação) — Jaccard sobre conjuntos de palavras ≥ 3 chars. Evita dependência externa.
- **Tolerância de valor**: `abs(a-b) <= max(0.02, b*0.005)`.
- **Escopo**: respeita `context` (Pessoal vs Empresa) e `owner_id` ativo do WhatsApp (já resolvido no início do webhook).
- **Não aplica** quando: parcelamento detectado, cartão de crédito (fatura já tem fluxo próprio), ou comprovante sem valor extraído.
- **Sem mudanças de schema** — usa apenas `transactions` e `whatsapp_pending_actions` existentes.

## Itens não inclusos (confirmar se deseja depois)
- Reconciliação no app web (fora do WhatsApp).
- Match contra `recurring_transactions` projetadas.
- Auto-baixa sem confirmação quando score = 3/3 + barcode igual.
