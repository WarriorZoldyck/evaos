# Integrar Claude Sonnet 4.5 na importação de extratos

## Objetivo
Trocar o modelo principal do parser de extratos (`parse-bank-statement`) de Gemini pra **Claude Sonnet 4.5** da Anthropic, mantendo Gemini como fallback automático se o Claude falhar/estourar timeout.

## O que você precisa fazer (uma vez)

1. Criar conta em **console.anthropic.com** (se ainda não tem).
2. Adicionar créditos (mínimo US$ 5 pra testar — cada extrato completo custa ~US$ 0,05-0,15).
3. Gerar uma API Key em **Settings → API Keys**.
4. Colar a chave quando eu pedir (vou abrir o formulário seguro).

**Custo esperado por extrato:** ~R$ 0,25 a R$ 0,75 (bem mais caro que Gemini, que era ~R$ 0,02, mas com qualidade superior em faturas complexas).

## O que eu vou implementar

### 1. Novo secret `ANTHROPIC_API_KEY`
Pedir via `add_secret` (não fica exposto no código, só na edge function).

### 2. Refatorar `supabase/functions/parse-bank-statement/index.ts`

Adicionar função `callClaudeDirect()` que chama `https://api.anthropic.com/v1/messages` com:
- Modelo: `claude-sonnet-4-5-20250929`
- PDF como `document` block (base64)
- Mesmo `SYSTEM_PROMPT` compacto que já temos
- `max_tokens: 16000`, timeout 90s
- Header `anthropic-version: 2023-06-01`

Reordenar a cascata de tentativas:
```
1º) Claude Sonnet 4.5      (Anthropic direto)      — 90s
2º) Gemini 3 Flash Preview (Lovable AI Gateway)    — 70s  [fallback rápido]
3º) Gemini 2.5 Pro         (Lovable AI Gateway)    — 90s  [último recurso]
```

Adicionar adapter que converte o response do Claude (`content[0].text`) pro mesmo formato que o `parseTxJson` já espera — sem tocar em nada downstream.

### 3. Logs e observabilidade
Cada tentativa loga: modelo usado, tempo, tokens de saída, motivo de fallback (se houve). Assim conseguimos medir se o Claude está realmente entregando qualidade superior antes de considerar torná-lo obrigatório.

### 4. Tratamento de erro específico do Claude
- 401 → chave inválida, log claro e pula pro fallback
- 429 → rate limit, pula pro fallback
- 529 → Anthropic overloaded, pula pro fallback
- Créditos zerados na Anthropic → log e pula pro fallback (usuário continua conseguindo importar via Gemini)

## O que NÃO vou mexer

- `ImportStatementModal.tsx` (client)
- Lógica de matching, criação de cartão, reconciliação
- Outras edge functions que usam Lovable AI (eva-chat, whatsapp-webhook, suggest-categories, etc.) — continuam no Gemini
- Fluxo de `CreditCardFormModal` inline

## Riscos e trade-offs (transparência)

- **Latência:** Claude Sonnet 4.5 pra PDFs grandes leva 40-80s típico. Não vai ser dramaticamente mais rápido que Gemini — a diferença real é **qualidade da extração**, especialmente em faturas multi-cartão, IOF internacional, e descrições truncadas.
- **Custo sai da sua conta Anthropic**, não dos créditos Lovable. Se você importar 100 extratos/mês, gasta ~US$ 10-15.
- **Se a Anthropic ficar fora**, o fallback pro Gemini garante que ninguém fica travado.
- Depois de rodar por 1-2 semanas conseguimos comparar acurácia real Claude vs Gemini e decidir se vale manter Claude como principal ou usar só em casos específicos.

## Próximo passo depois do plano aprovado
Abro o formulário seguro pra você colar a `ANTHROPIC_API_KEY` e sigo direto com a implementação.
