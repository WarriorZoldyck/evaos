## Problema

Os logs do AI Gateway mostram que cada importação está:
1. Chamando `google/gemini-2.5-flash` → ~50s e **estoura os 16k tokens** de saída (`finish_reason=length`, resposta truncada).
2. Como veio truncada, cai no fallback `google/gemini-2.5-pro` → mais 60-90s.
3. Total: >2 minutos, e mesmo assim a fatura pode voltar incompleta.

A raiz é o schema JSON verboso: cada transação repete `statement_due_date`, `statement_close_date`, `statement_total`, `cardholder_name`, `card_digits`. Uma fatura de 80-120 lançamentos satura o output.

## Plano

Edições em `supabase/functions/parse-bank-statement/index.ts`:

1. **Trocar o modelo padrão** de `google/gemini-2.5-flash` para `google/gemini-3-flash-preview` (default da plataforma, mais rápido e melhor em documentos multimodais). Manter `google/gemini-2.5-pro` só como último fallback.

2. **Compactar o schema de saída** para reduzir drasticamente os tokens:
   - Retornar um objeto `{ meta: {...}, txs: [...] }` em vez de array plano.
   - `meta` contém UMA vez: `due_date`, `close_date`, `total`, e um mapa `cards: { "1234": "Nome Titular", ... }`.
   - Cada `tx` fica enxuta: `{ d: "DD/MM", desc: "...", a: 49.9, t: "d"|"r", c: "1234" }` (nomes curtos, `t` = tipo em uma letra, `c` = card digits).
   - Depois de parsear, o código expande cada tx aplicando `meta` — o resto do pipeline continua igual.

3. **Aumentar `max_tokens` da primeira tentativa** para `24000` (agora o schema compacto cabe com folga, mas garante margem para faturas grandes).

4. **Reduzir o timeout da 1ª tentativa** para `70s` (com schema compacto o flash termina bem antes) e só disparar o fallback pro `2.5-pro` se o flash falhar/timeout — não mais quando o flash retorna zero (esse caso ficou raro com o schema novo).

5. **Manter a lógica de salvamento de JSON truncado** já existente, adaptada ao novo formato.

### Detalhes técnicos

- `SYSTEM_PROMPT` é reescrito para pedir o objeto compacto e explicar que `meta` não deve ser repetida por linha.
- `parseAIResponse` / `parseTxJson` passam a aceitar `{ meta, txs }` e expandem para o `ParsedTransaction[]` atual (nenhuma outra parte do sistema muda).
- Os campos exportados (`detected_card_digits`, `cardholder_name`, `statement_due_date`, etc.) continuam iguais na saída HTTP → sem impacto no frontend nem no `ImportStatementModal`.

## Ganho esperado

- Resposta cai de ~16k para ~4-6k tokens numa fatura típica → tempo da 1ª chamada de ~50s para ~15-25s.
- Sem truncamento → fallback deixa de disparar na maioria dos casos.
- Importações típicas devem ficar em **20-30s** em vez de 2+ minutos.
