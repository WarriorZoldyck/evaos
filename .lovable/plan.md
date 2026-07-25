## Objetivo
Voltar 100% ao feedback simples e antigo no WhatsApp quando o usuário cria um lançamento pela IA: só a mensagem de confirmação enxuta + "Acesse Análises EVA no app para aprovar". Sem imagem, sem link "Abrir no app" e sem menu Aprovar/Cancelar/Editar.

## O que remover em `supabase/functions/whatsapp-webhook/index.ts`

1. **Rodapé de sugestão de baixa na mensagem principal** (linha 4174)
   - Tirar `${boletoSuggestionTail || ""}` do template do `respond({ message: ... })` do intent `lancamento`.
   - Resultado: mensagem final volta a ser exatamente o formato antigo:
     ```
     📋 Lançamento enviado para aprovação no app!
     📝 <descrição>
     💰 <valor>
     📁 <tipo> / <categoria>
     🏢 <contexto>
     📅 Competência: … | Pagamento: …
     🏦 <conta/cartão>
     ⚠️ Acesse "Análises EVA" no app para aprovar.
     ```

2. **Dispatch assíncrono do card PNG + sendList/sendButtons** (linhas ~4056–4152)
   - Remover completamente o bloco `if (boletoMatch && pendingId && phone) { … }` que:
     - cria `whatsapp_pending_actions` com `action_type: "confirm_boleto_match"`
     - constrói `deepLink` / `editLink`
     - monta `boletoSuggestionTail`
     - renderiza PNG do boleto e chama `sendEvolutionImage`
     - envia `sendEvolutionList` / `sendEvolutionButtons` com os botões Aprovar/Não/Editar
     - agenda tudo com `EdgeRuntime.waitUntil`
   - Também remover as variáveis `boletoSuggestionMessage` e `boletoSuggestionTail` (deixam de ser usadas).

3. **Preservar (não mexer)**
   - `boletoSuggestionBlock` continua sendo concatenado em `notes` do `ai_pending_transactions.insert` — isso é interno, ajuda a EVA a mostrar match em Análises EVA e não vaza pro WhatsApp.
   - `boletoMatch` em si continua sendo detectado (não removemos a lógica de detecção nas linhas ~3970–4009), só não gera mais efeito colateral no WhatsApp.
   - Handler `confirm_boleto_match` já existente (respostas 1/2/3 do usuário) fica; se não houver mais `whatsapp_pending_actions` criado, ele simplesmente não é acionado.

## Fora de escopo
- Não alterar fluxos de parcelas (linha 1697) nem de criação de categoria (linha 1902) — ambos já estão no formato antigo enxuto.
- Não alterar Análises EVA no app.
- Não mexer em `whatsapp-boleto-card.ts` (fica sem uso; podemos limpar depois se quiser).