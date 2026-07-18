## Diagnóstico (confirmado)

O PDF de teste `fatura-4.pdf` tem só **3 páginas / 145 KB** — não é problema de tamanho. Nos logs do AI Gateway aparecem duas chamadas ao `google/gemini-2.5-pro` **canceladas em 154.470 ms** (HTTP 499) durante as tentativas de importação do usuário. Quando o Gemini 2.5 Pro não responde a tempo, a Supabase Edge Runtime mata o isolate e devolve **HTTP 546 (WORKER_LIMIT)** ao cliente. No front, o `supabase.functions.invoke` fica pendurado e o modal "carrega e não vai".

Casos anteriores bem-sucedidos com o mesmo modelo levaram de 15s a 134s — latência muito instável. E uma execução chegou a gerar 25.674 tokens de saída (1,03 créditos por importação), o que é caro e lento para uma fatura de 3 páginas.

Causa: dependência de um modelo lento/instável, sem timeout no `fetch`, sem fallback, e sem timeout no cliente.

## Passos

1. **Trocar o modelo padrão para `google/gemini-2.5-flash`** em `supabase/functions/parse-bank-statement/index.ts`
   - Flash resolve faturas estruturadas com folga, é ~5× mais rápido e muito mais barato.
   - Reduzir `max_tokens` de 65.000 → 16.000 (fatura de 3 páginas cabe folgado; se `finish_reason === "length"`, aí sim escalar).

2. **Adicionar timeout duro na chamada ao AI Gateway**
   - Envolver o `fetch` para `ai.gateway.lovable.dev` em `AbortController` com `signal` e timeout de **90 s**.
   - Se abortar/timeout, capturar e devolver JSON `{ error: "O modelo demorou demais para processar o extrato. Tente novamente ou envie em OFX/CSV." }` com status 504 — nunca deixar o worker morrer sem resposta.

3. **Fallback automático flash → pro** (apenas se necessário)
   - Se o flash retornar 0 transações OU JSON inválido/salvo com salvamento, tentar `gemini-2.5-pro` **uma vez** com o mesmo timeout de 90 s.
   - Se ainda falhar, retornar erro claro ao cliente.

4. **Timeout de segurança no cliente** (`src/components/lancamentos/ImportStatementModal.tsx`)
   - `Promise.race` de 120 s ao redor do `supabase.functions.invoke('parse-bank-statement', ...)`. Se estourar, encerra o spinner, mostra toast: *"O processamento demorou demais. Tente novamente."*
   - Tratamento uniforme para `fnError` e `data?.error` (hoje o modal pode ficar pendurado se o gateway nem responder).

5. **Validar**
   - Redeploy da função é automático. Testar com `fatura-4.pdf` — expectativa: retornar em <30 s.
   - Testar OFX (não passa pela AI, deve continuar instantâneo).
   - Conferir `ai_gateway_logs`: nova chamada em flash, duração < 30s, sem 499.
   - Conferir `function_edge_logs`: status 200 na próxima execução, sem 546.

## Detalhes técnicos

- HTTP **499** = client abort no gateway; HTTP **546** = Supabase Edge Runtime worker terminado (CPU/mem/wall-clock). Os dois se combinam quando o modelo demora mais que o limite do worker.
- `AbortController` no `fetch` garante que a edge function devolva resposta em vez de esperar o runtime matá-la.
- Sem mudanças de schema, RLS, secrets ou UI de página.
- Sem alteração no comportamento para arquivos OFX/CSV.
