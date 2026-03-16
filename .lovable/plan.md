

# Fix: WhatsApp não lança cartão de crédito corretamente

## Bugs encontrados

Analisei o `whatsapp-webhook/index.ts` e encontrei **4 problemas concretos**:

### Bug 1: `payment_method` com valor incompatível
O webhook salva `payment_method` como `"cartao_credito"` (snake_case), mas o sistema inteiro (UI, filtros, TransactionFormModal) usa `"Cartão de Crédito"`. Resultado: o lançamento não é reconhecido como cartão na interface.

### Bug 2: Fallback cego quando AI diz "cartao_credito" sem UUID
Linha 731: se a AI retorna `payment_method: "cartao_credito"` mas sem `credit_card_id`, o código pega `contextCards[0]` sem perguntar. Se o usuário tem múltiplos cartões, pode ir pro cartão errado. Se não tem nenhum, segue sem cartão.

### Bug 3: Cálculo de data usa `toISOString()` (timezone shift)
Linha 846: `dueDate.toISOString().split("T")[0]` converte para UTC, o que pode mudar o dia em fusos brasileiros (UTC-3). Deve usar formatação manual.

### Bug 4: Ambiguidade cartão + múltiplas contas
Quando o cartão é resolvido, o `bank_account_id` vem do `card.bank_account_id` (correto), mas o fluxo de "múltiplas contas" (linha 750-774) pode interceptar antes e perguntar qual conta, mesmo quando já tem cartão.

---

## Correções planejadas

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**1. Mapear payment_method para o formato do sistema**

Após resolver o `paymentMethod` do AI, converter para os valores usados pela UI:
```typescript
const PAYMENT_METHOD_MAP: Record<string, string> = {
  "pix": "PIX",
  "dinheiro": "Dinheiro",
  "cartao_debito": "Cartão de Débito",
  "cartao_credito": "Cartão de Crédito",
  "boleto": "Boleto",
  "transferencia": "Transferência",
};
paymentMethod = PAYMENT_METHOD_MAP[paymentMethod] || paymentMethod;
```

**2. Quando AI diz cartão mas não dá UUID: perguntar qual cartão**

Substituir o fallback cego (linha 731-734) por lógica que pergunta ao usuário:
```typescript
if (!creditCardId && paymentMethod === "Cartão de Crédito") {
  if (contextCards.length === 1) {
    creditCardId = contextCards[0].id;
    bankAccountId = contextCards[0].bank_account_id;
  } else if (contextCards.length > 1) {
    // Perguntar qual cartão
    const list = contextCards.map(c => `• ${c.name}${c.last_four_digits ? ` (final ${c.last_four_digits})` : ""}`).join("\n");
    return Response.json({ message: `💳 Em qual cartão foi essa compra?\n\n${list}` });
  }
}
```

**3. Corrigir cálculo de data sem timezone shift**

Substituir `dueDate.toISOString().split("T")[0]` por formatação manual:
```typescript
const pad = (n: number) => String(n).padStart(2, "0");
paymentDate = `${dueDate.getFullYear()}-${pad(dueDate.getMonth() + 1)}-${pad(dueDate.getDate())}`;
```

**4. Pular lógica de "múltiplas contas" quando já tem cartão de crédito**

A seção de account resolution (linha 737-776) já está dentro de `if (!creditCardId)`, mas o `bankAccountId` vem do cartão. Garantir que quando `creditCardId` está setado, não entre na validação de "sem conta".

**5. Garantir status "Pendente" quando é cartão**

Já está na linha 872-873, mas preciso garantir que o mapeamento do payment_method aconteça ANTES dessa checagem.

---

## cURL atualizado (sem mudanças no payload)

O payload continua idêntico. Exemplos de teste:

```bash
# Compra no cartão de crédito
curl -X POST "https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET_AQUI" \
  -d '{"phone":"5511999999999","message":"Comprei um tênis de 350 reais no cartão Nubank"}'

# Despesa via Pix
curl -X POST "https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET_AQUI" \
  -d '{"phone":"5511999999999","message":"Paguei 200 de luz via pix pelo Itaú"}'

# Pergunta sobre cartões
curl -X POST "https://rrrnnrjefyffllnrwhkz.supabase.co/functions/v1/whatsapp-webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: SEU_SECRET_AQUI" \
  -d '{"phone":"5511999999999","message":"Quais cartões tenho cadastrados?"}'
```

**Resultado esperado para compra no cartão:**
- `credit_card_id` = UUID do Nubank
- `payment_method` = "Cartão de Crédito" (não mais "cartao_credito")
- `status` = "Pendente"
- `competence_date` = hoje
- `payment_date` = calculada pelo ciclo (closing_day/due_day)
- `bank_account_id` = conta vinculada ao cartão

---

### Resumo de mudanças

| Local | Mudança |
|-------|---------|
| Linhas ~719-734 | Mapear payment_method snake_case → formato UI + perguntar qual cartão se ambíguo |
| Linha ~846 | Trocar `toISOString()` por formatação manual de data |
| Linhas ~750-774 | Garantir que credit card já resolvido não entre no fluxo de "qual conta" |

