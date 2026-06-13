# Correção do WhatsApp + Reconciliação via Análises EVA

## Diagnóstico

A foto do Renato **não foi respondida** porque o `whatsapp-webhook` está com **boot error** desde a última deploy:

```
worker boot error: Uncaught SyntaxError:
Identifier 'normalizeText' has already been declared
at .../whatsapp-webhook/index.ts:203:1
```

Na implementação anterior eu criei `function normalizeText` na linha 52 sem perceber que já existia outra `function normalizeText` na linha 248. Como o arquivo não compila, **nenhuma mensagem está sendo processada** (não é só boleto — é tudo).

Além disso, você decidiu mudar a UX: em vez de perguntar via WhatsApp e dar baixa direto, o match deve ir para **Análises EVA** com a sugestão visível, e o usuário decide lá com calma.

## Mudanças

### 1. `supabase/functions/whatsapp-webhook/index.ts` — corrigir boot
- Renomear os helpers novos para não colidir com os existentes:
  - `normalizeText` (linha 52) → `normalizeBoletoText`
  - `tokens` (auxiliar) → `boletoTokens`
  - `jaccardSimilarity` mantém o nome (não colide).
- Atualizar as chamadas dentro de `findMatchingPendingBoleto` para usar os novos nomes. Nada fora dessa função é tocado.

### 2. Reverter fluxo de confirmação por WhatsApp
- **Remover** o branch que cria `whatsapp_pending_actions` do tipo `confirm_boleto_match` e envia "Encontrei um boleto já lançado… responda Sim/Não".
- **Remover** o handler `if (pendingAction.action_type === "confirm_boleto_match")` (linhas ~1515+).
- Não há mais UPDATE direto em `transactions` pelo webhook a partir de comprovante.

### 3. Novo fluxo: sugestão dentro de Análises EVA
Quando `findMatchingPendingBoleto` retornar um candidato com score ≥ 2:
- Continuar inserindo a transação em `ai_pending_transactions` (fluxo normal),
- Adicionar no campo `notes` um bloco estruturado de sugestão, ex.:
  ```
  [SUGESTAO_BAIXA]
  transaction_id: <uuid>
  descricao: <desc do pendente>
  valor: 1234.56
  vencimento: 2026-06-10
  fornecedor: <nome>
  score: 2
  ```
- Anexar também na `ai_response_message` a frase humana: *"Encontrei um lançamento pendente parecido: {desc} • R$ {valor} • venc. {data}. Confira em Análises EVA e dê baixa se for o mesmo."*
- Enviar 1 mensagem ao usuário no WhatsApp: *"📥 Recebi seu comprovante e encontrei um possível lançamento pendente parecido no sistema. Coloquei em **Análises EVA** com a sugestão — confira no app e confirme a baixa por lá. 👍"*
- Se não houver match: comportamento atual (mensagem padrão de "lançamento criado em Análises EVA").

### 4. UI — Análises EVA exibe sugestão
- `src/pages/AnalisesEva.tsx` / componente que lista os pendentes: detectar o bloco `[SUGESTAO_BAIXA]` no `notes` e mostrar um **badge "Possível baixa de pendente"** + card secundário com os dados do candidato e botão **"Dar baixa no pendente em vez de criar novo"**.
- Esse botão chama uma nova mutation que:
  1. `UPDATE transactions SET status='Pago', payment_date=<do pending>, bank_account_id/wallet_id=<do pending>, attachment_url=<do pending>` na transação `transaction_id` extraída.
  2. `UPDATE ai_pending_transactions SET status='approved', reviewed_at=now()` no pending (sem inserir nova linha em `transactions`).
- Botões já existentes (Aprovar / Rejeitar / Editar) continuam funcionando para o caso de o usuário decidir que **não** é o mesmo boleto.

### 5. Memória
- Atualizar `mem://whatsapp/boleto-reconciliation` refletindo o novo fluxo (Análises EVA, sem confirmação por WhatsApp, sem UPDATE direto no webhook).

## Detalhes técnicos

- Sem mudanças de schema. O `notes` já existe em `ai_pending_transactions` e em `transactions` — o bloco `[SUGESTAO_BAIXA]` é só um marcador parseado no front.
- `findMatchingPendingBoleto` permanece (lógica de score 0–3, janela −180/+30 dias, tolerância de valor). Só muda o que se faz com o resultado.
- Após o deploy, o `whatsapp-webhook` volta a bootar e a Eva passa a responder novamente (incluindo o comprovante que o Renato mandou).

## Itens não inclusos
- Reprocessar retroativamente a foto que o Renato enviou enquanto a função estava quebrada (Evolution só reentrega se reenviarmos a mensagem). Posso fazer se quiser.
- Auto-baixa sem revisão.
