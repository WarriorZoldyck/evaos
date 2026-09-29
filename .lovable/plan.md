# Áudio no chat da EVA (dentro do sistema)

## Objetivo
Permitir que o usuário grave e envie áudio no chat da EVA dentro do sistema (painel flutuante), como já acontece no WhatsApp — hoje o painel aceita só texto e imagem.

## Como vai funcionar
- Novo botão de microfone ao lado do campo de texto no chat da EVA.
- Ao clicar, começa a gravação (com permissão do navegador): o botão fica vermelho/pulsando com um cronômetro; clicar de novo envia, e há opção de cancelar.
- O áudio aparece na conversa como uma bolha "🎤 Áudio" com player para ouvir de novo.
- A EVA ouve o áudio e responde normalmente (criar lançamento, consultar saldo etc.), igual ao WhatsApp.
- Se o usuário digitou texto antes de gravar, o texto vai junto como contexto.

## Mudanças técnicas

### 1. `src/components/chat/EvaChatPanel.tsx`
- Botão de microfone usando `MediaRecorder` (formato `audio/webm`, padrão dos navegadores).
- Estados: gravando (botão vermelho pulsante + tempo decorrido + botão cancelar), enviando.
- Converte o áudio para base64 (data URL) e envia na mensagem como parte `file` (`{ type: "file", file: { filename: "audio.webm", file_data: dataUrl } }`), mesmo formato multimodal que o backend já entende.
- Bolha do usuário mostra player de áudio (`<audio controls>`) em vez de texto.
- Limite de ~2 minutos de gravação com parada automática (evita arquivos grandes).
- No caminho de fallback (chave de IA própria do usuário, sem backend), áudio não é suportado: mostra aviso amigável pedindo para usar texto ou imagem.

### 2. `supabase/functions/eva-chat/index.ts`
- O conteúdo multimodal já é repassado à IA; vou apenas garantir que, quando a última mensagem tiver áudio, o prompt instrua a EVA a transcrever e interpretar o áudio como pedido do usuário (ex.: lançamentos falados), e que os pontos que hoje assumem texto puro (`lastUser.content` como string) tratem o caso de áudio sem quebrar.

### 3. Backend de IA
- Nenhuma mudança necessária: o provedor Gemini (`_shared/ai-gateway.ts`) já converte partes `file` com data URL em `inlineData`, incluindo áudio — mesmo caminho usado pelo WhatsApp.

## Publicação
- Reimplantar `eva-chat`.

## Verificação
- Confirmar build sem erros.
- Não consigo testar o microfone de verdade (requer permissão e hardware); vou validar que o botão aparece e que o painel abre sem erros. Peço ao usuário gravar um áudio de teste (ex.: "gastei 50 reais no mercado") e conferir a resposta da EVA.
