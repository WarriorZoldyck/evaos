
## O que ajustar

### 1. Botões não aparecem no WhatsApp
O WhatsApp descontinuou o `buttonsMessage` clássico do Baileys — por isso o `sendButtons` retorna 200 mas o app não renderiza nada (fica só a mensagem de texto/imagem).

Trocar para o caminho que ainda funciona hoje na Evolution API:

- Novo helper `sendEvolutionList(phone, title, description, buttonText, sections)` chamando `POST /message/sendList/{instance}` com uma seção "Baixa pendente" contendo 3 rows: `confirm_baixa`, `reject_baixa`, `open_edit`. WhatsApp renderiza como um menu clicável ("Selecionar opção").
- Fallback automático se `sendList` também falhar (algumas contas comerciais bloqueiam): append no caption da imagem o texto:
  ```
  Responda com:
  1 — Sim, dá baixa
  2 — Não, é outro
  3 — Editar no app
  ```
- Expandir o dispatcher `confirm_boleto_match` para reconhecer, além do que já existe, `1/2/3` e o `listResponseMessage.singleSelectReply.selectedRowId` (já forwardado pelo webhook mas passa a valer as ids `confirm_baixa|reject_baixa|open_edit`).
- Remover a chamada atual a `sendEvolutionButtons` (fica só como dead code opcional) para não gastar request numa API que WhatsApp ignora.

### 2. Card em tema claro, parecido com Análises EVA
Redesenhar `supabase/functions/_shared/whatsapp-boleto-card.ts` para espelhar o card da tela (o print mostra que o card atual ficou "vazio" no meio — descrição some quando é curta, e o dark destoa do WhatsApp claro).

Alterações no satori tree:

- Fundo `#FFFFFF`, borda `1px solid #E2E8F0`, sombra leve, radius 20px.
- Header: chip do tipo do lançamento (`Despesa` em vermelho suave / `Receita` em verde), à direita chip `PENDENTE • MATCH PROVÁVEL` em amarelo suave (fundo `#FEF3C7`, texto `#92400E`) — mesma paleta usada em `PendingCard`.
- Título grande (`#0F172A`, 22px, bold): descrição.
- Linha secundária cinza (`#64748B`) com ícone 👤 + fornecedor e 🏦 + conta (quando houver no payload).
- Grid 2 colunas inferior com labels `VALOR` / `VENCIMENTO` iguais aos atuais, mas em `#64748B` e valores em `#0F172A` (valor em `#DC2626` para despesa, `#16A34A` para receita).
- Rodapé com selo `EVA OS · Sugestão de baixa` em cinza pequeno.
- Aumentar `renderBoletoCardPng` para receber `type` (`despesa`/`receita`) e `bank_account_name` opcional (o webhook já tem esses dados no `match`/`payload`).

Se `renderBoletoCardPng` retornar `null`, o fallback texto continua igual.

### 3. Link não abre no contexto certo em Análises EVA
Hoje `AnalisesEva.tsx` só olha `pendingTransactions` já filtradas pelo contexto ativo. Se o usuário estava em "Pessoal" e o boleto é de uma empresa, o `find` não acha nada e o modal nunca abre.

Ajustes:

- No webhook, ao montar o deep-link, acrescentar `&ctx=<company_id|personal>` (usa `match.company_id`, ou `personal` quando nulo).
- Em `src/pages/AnalisesEva.tsx`, no `useEffect` de deep-link:
  1. Ler `ctx` de `searchParams`.
  2. Se `ctx === "personal"` → `setSelectedCompanyId(null)`; se for UUID → `setSelectedCompanyId(ctx)`.
  3. Só após o contexto certo estar carregado (checar `pendingTransactions.find`), aplicar highlight / abrir modal.
  4. Se o item ainda não aparecer após troca de contexto, fazer um `supabase.from("ai_pending_transactions").select("company_id").eq("id", pendingId).maybeSingle()` para inferir contexto automaticamente (caso `ctx` não venha).
- Limpar `ctx` do URL junto com `pending` e `edit`.

### 4. Memória
Atualizar `.lovable/memory/whatsapp/boleto-reconciliation.md` para refletir: `sendList` em vez de `sendButtons`, card claro, deep-link com `ctx`.

## Arquivos tocados
- `supabase/functions/whatsapp-webhook/index.ts` — novo `sendEvolutionList`, troca da chamada, dispatcher aceita `1/2/3` + `selectedRowId`, deep-link ganha `ctx`.
- `supabase/functions/_shared/whatsapp-boleto-card.ts` — redesign claro, novos props `type` e `bank_account_name`.
- `src/pages/AnalisesEva.tsx` — deep-link troca contexto antes de abrir.
- `.lovable/memory/whatsapp/boleto-reconciliation.md`.

Sem migrations, sem mudanças de schema.
