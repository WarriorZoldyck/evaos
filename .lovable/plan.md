## Contexto

Hoje a EVA já detecta o pendente e devolve o texto que aparece na sua print (bloco `[SUGESTAO_BAIXA]` gravado nas `notes` do `ai_pending_transactions`, confirmação só dentro de Análises EVA). Vamos:

1. Endurecer o match do boleto (o caso "JJGC INDUSTRIA C M D SA" vs. "JJGC INDUSTRIA E COM.DE MATERIAIS DENTARIOS S.A" com R$ 165,17 é o exemplo real — pode passar hoje pelos limites atuais, mas há vários pontos frouxos que causam falso-negativo).
2. Enviar junto com a resposta um **card visual em PNG** do pendente encontrado + **link** que abre direto na sugestão em Análises EVA.
3. Aceitar decisão do usuário pelo WhatsApp via **botões nativos** da Evolution API (Sim, dar baixa / Não é o mesmo / Editar no app).

---

## 1. Ajustes no match (`findMatchingPendingBoleto`)

Arquivo: `supabase/functions/whatsapp-webhook/index.ts` (linhas ~52–156).

- **Tolerância de valor mais realista para boleto**: hoje o `hard filter` corta se diferença > `max(R$ 2, 10%)` e o `amountMatches` exige `≤ R$ 0,02 ou 0,5%`. Boleto com juros/multa de 1 dia estoura fácil. Novo padrão:
  - `amountMatches`: aceitar até `max(R$ 5, 3%)` de diferença → ganha 1 ponto.
  - Hard filter: descartar só se diferença > `max(R$ 20, 15%)`.
- **Similaridade de fornecedor mais tolerante a razão social**: normalizar removendo sufixos jurídicos (`s.a`, `s/a`, `ltda`, `me`, `epp`, `industria`, `comercio`, `com`, `ind`, `de`, `da`, `do`, `materiais`, etc. — lista pequena e conservadora) antes do Jaccard, e baixar o limiar de `0.5` para `0.4`. Manter os outros dois caminhos (id igual + substring).
- **Adicionar sinal de data**: se `payment_date` do candidato está a ±10 dias do `payment_date` informado agora, +1 ponto (com teto de 3 mantido).
- **Aceitar score ≥ 2 como hoje**, mas registrar log estruturado com `score`, `supplierMatch`, `amountMatch`, `descMatch`, `dateMatch` e o `id` do candidato — hoje só logamos quando encontra; vamos logar também os "quase-match" (score = 1) para depurar futuros falsos-negativos.
- **Ampliar janela** de `payment_date` para −365d / +60d (boletos antigos reagendados aparecem).
- **Preservar nomes existentes** dos helpers (`normalizeBoletoText`, `tokenSet`, `jaccardSimilarity`, `amountMatches`) — a memory `whatsapp/boleto-reconciliation` já registra que renomear causa colisão.

## 2. Card visual PNG enviado pelo WhatsApp

Objetivo: gerar uma imagem estilo "mini-card EVA" (fundo escuro `#0B1120`, borda cyan `#48CAE4`, logo/monograma EVA, descrição, valor grande, vencimento, fornecedor, badge "PENDENTE") e mandar como imagem no mesmo fluxo em que hoje enviamos o texto.

**Como renderizar dentro da edge function** (Supabase Edge / Deno):

- Usar `satori` (JSX-like → SVG) + `@resvg/resvg-wasm` (SVG → PNG), ambos via `npm:` no Deno. É o mesmo stack usado por Vercel OG e funciona em Deno Deploy.
- Carregar 1 fonte woff2 (Inter regular + bold) via `fetch` de CDN pública no primeiro cold start, com cache em módulo.
- Novo helper `buildBoletoMatchCardPng(match, opts)` no `whatsapp-webhook/index.ts` que retorna `Uint8Array` PNG (~30–60 KB).

**Como enviar pela Evolution API**:

- Novo helper `sendEvolutionImage(phone, base64Png, caption)` que chama `POST {EVO}/message/sendMedia/{instance}` com body:
  ```json
  { "number": "...", "mediatype": "image", "mimetype": "image/png",
    "media": "<base64>", "fileName": "sugestao-baixa.png", "caption": "<texto>" }
  ```
- Se o `sendMedia` falhar (log de erro), fallback silencioso para o `sendEvolutionReply` de texto que já temos hoje — nunca deixar de responder o usuário.

**Link para o app**: já temos a rota `/analises-eva`. Vamos anexar no caption `👉 Abrir no app: https://eva.tec.br/analises-eva?pending=<pendingId>` (usar `VITE_APP_URL` se existir; senão hardcode do domínio custom `eva.tec.br`). O `pending=<uuid>` fica pronto pra ser lido em `AnalisesEva.tsx` e dar scroll + destaque no card correspondente (pequeno ajuste no `useEffect` inicial da página).

## 3. Botões nativos da Evolution API (Sim / Não / Editar)

A Evolution API expõe `POST {EVO}/message/sendButtons/{instance}` (WhatsApp Business "reply buttons", máx. 3 botões, texto curto). É a única forma "clicável" que a Evolution suporta hoje — não existe botão que abra um deep link arbitrário dentro do WhatsApp for Business puro, mas o botão pode disparar uma resposta cujo texto voltamos a receber no webhook e tratamos como confirmação.

**Fluxo proposto**:

1. Quando `boletoSuggestionMessage` é montado, além de inserir o `[SUGESTAO_BAIXA]` no pending, criamos um registro em `whatsapp_pending_actions` com:
   - `action_type = 'confirm_boleto_match'`
   - `payload = { pending_id, transaction_id, amount, description }`
   - `expires_at = now() + 10 min`
2. Enviamos o card PNG (item 2) via `sendEvolutionImage`, seguido de `sendEvolutionButtons` com 3 botões:
   - `✅ Sim, é esse` → id `confirm_baixa:<action_id>`
   - `❌ Não, é outro` → id `reject_baixa:<action_id>`
   - `✏️ Editar no app` → id `open_edit:<action_id>` (o clique só serve como sinal; junto mandamos o link `https://eva.tec.br/analises-eva?pending=<id>&edit=1` no texto para o usuário abrir).
3. No handler do webhook, antes do fluxo de IA, interceptar `buttonResponseMessage` / `templateButtonReplyMessage` (Evolution encaminha isso como um `message` novo com `selectedButtonId` ou texto igual ao id):
   - `confirm_baixa:*` → executa direto o mesmo `handleReconcile` que hoje o `PendingCard` chama (UPDATE `transactions` para `Pago` + UPDATE `ai_pending_transactions` para `approved`). Responde no WhatsApp com "✅ Baixa feita! Saldo atualizado.".
   - `reject_baixa:*` → apenas marca o pending como normal (remove o bloco `[SUGESTAO_BAIXA]` das notes) e responde "Beleza, mantive como lançamento novo".
   - `open_edit:*` → só responde com o link + "Abre aí que já deixei o formulário pronto".
4. Após qualquer clique, `whatsapp_pending_actions` é marcado `resolved`.

**Importante** — a memory `whatsapp/boleto-reconciliation` diz explicitamente "não existe `confirm_boleto_match` no `whatsapp_pending_actions` e o webhook nunca faz UPDATE direto em `transactions`". Esta feature **muda essa regra por decisão sua**; vou atualizar essa memory como parte do build para refletir o novo comportamento e evitar que futuras sessões desfaçam por engano.

**Sobre "editar no WhatsApp"**: WhatsApp/Evolution não suportam formulário embutido. O melhor viável hoje é o botão "Editar no app" abrindo o deep link direto no card em Análises EVA já em modo edição. Fluxo 100% dentro do WhatsApp (mensagem-por-mensagem "manda o novo valor", "manda a nova data") é possível mas complexo e propenso a erro — não recomendo no primeiro corte; se quiser depois, dá pra estender o `whatsapp_pending_actions` para virar uma mini-máquina de estados de edição.

---

## Detalhes técnicos (para referência)

**Arquivos tocados**:
- `supabase/functions/whatsapp-webhook/index.ts` — ajustes no match, novos helpers `sendEvolutionImage`, `sendEvolutionButtons`, `buildBoletoMatchCardPng`; novo branch de dispatch para `buttonResponseMessage`; criação do registro em `whatsapp_pending_actions`; handler de `confirm_baixa` que roda o UPDATE.
- `src/pages/AnalisesEva.tsx` — leitura de `?pending=<id>&edit=1` no query string para scroll/highlight/abrir modal de edição do card correspondente.
- `.lovable/memory/whatsapp/boleto-reconciliation.md` — atualizar para refletir o novo `confirm_boleto_match` e o UPDATE via webhook.

**Nenhuma migração de DB** é necessária: `whatsapp_pending_actions` já existe (memory `whatsapp/state-management`). Só passamos a usar um novo `action_type`.

**Dependências novas nas edge functions** (via `npm:` — sem instalar nada localmente):
- `npm:satori@0.10`
- `npm:@resvg/resvg-wasm@2.6`

**Sem novos secrets**: usamos `EVOLUTION_API_URL/KEY/INSTANCE` que já existem.

**Fora de escopo**: mudar layout de Análises EVA, tocar em outros fluxos WA (parcelas, cartão, transferência), rebuild do UI do app.

## Como validar

1. Enviar no WhatsApp uma foto/PDF de boleto de um fornecedor que já tenha um pendente próximo do mesmo valor → resposta chega com card PNG + 3 botões + texto.
2. Clicar em "✅ Sim, é esse" → verificar em `transactions` que o pendente virou `Pago` com `payment_date` de hoje, e em `ai_pending_transactions` que o registro auxiliar ficou `approved` sem duplicar lançamento.
3. Clicar em "❌ Não, é outro" → pendente original segue `Pendente`, novo lançamento aparece normalmente em Análises EVA sem o bloco de sugestão.
4. Clicar em "✏️ Editar no app" → link abre `/analises-eva?pending=<id>&edit=1` e o modal de edição do card correto abre automaticamente.
5. Repetir o cenário do print (JJGC 165,17) e um cenário com R$ 2 de diferença por juros — ambos devem casar agora.
