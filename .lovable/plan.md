## Diagnóstico confirmado

- O `whatsapp-webhook` está falhando para iniciar na versão mais recente por erro de código: `Identifier 'boletoMatch' has already been declared`.
- A chamada anterior que ainda respondeu com sucesso levou **43,8 segundos**, principalmente no fluxo com mídia/imagem e IA antes de enviar o feedback ao WhatsApp.
- Também há resíduo de lógica antiga de lista/botões (`sendEvolutionList`) que precisa ficar neutra para não reabrir o problema anterior.

## Plano de correção

1. **Corrigir o boot failure imediatamente**
   - Remover a declaração duplicada de `boletoMatch` no `whatsapp-webhook`.
   - Garantir que a função volte a subir sem erro 503.

2. **Reduzir o tempo de resposta percebido no WhatsApp**
   - Manter o feedback simples e antigo para o usuário.
   - Enviar a resposta do webhook o mais cedo possível quando o lançamento for criado/enviado para Análises EVA.
   - Evitar que tarefas secundárias segurem a resposta HTTP principal.

3. **Remover/neutralizar sobras do modelo novo**
   - Conferir e limpar referências que possam acionar lista, imagem, link, aprovar, editar ou cancelar.
   - Manter ações antigas de `whatsapp_pending_actions` como ignoradas/expiradas, sem responder menu ao usuário.

4. **Instrumentar tempos nos logs**
   - Adicionar logs objetivos de duração por etapa crítica: identificação do usuário, mídia, IA, criação do lançamento e envio Evolution.
   - Isso permite saber se a demora vem da Evolution, da IA multimodal, do upload de mídia ou do banco.

5. **Deploy e validação**
   - Deploy do `whatsapp-webhook`.
   - Verificar logs recentes para confirmar: sem boot error, sem `sendEvolutionList`, status 200 e tempo menor no webhook.

## Resultado esperado

O WhatsApp volta a receber apenas a mensagem simples antiga, sem botões/link/imagem, e a função deixa de falhar com 503. Também teremos logs melhores para atacar qualquer demora externa restante com precisão.