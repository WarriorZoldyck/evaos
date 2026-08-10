# EVA reconhece sugestões e feedback no WhatsApp

Hoje, quando o usuário manda uma mensagem do tipo "seria bom se a EVA fizesse X" ou "não gostei de como ficou a tela de metas", a EVA tende a interpretar como tentativa de lançamento ou responde de forma genérica. Vamos ensiná-la a identificar isso como feedback.

## Comportamento desejado

- A EVA reconhece mensagens de sugestão, elogio, crítica ou relato de problema no produto.
- Ela responde agradecendo, confirma que entendeu o ponto e diz que vai encaminhar para a equipe.
- Não cria lançamento, não altera categoria, não faz consulta.
- Se a mensagem misturar feedback com uma operação real (ex.: "registra 50 no mercado, e acho que a EVA devia avisar antes"), a operação continua sendo executada normalmente e o agradecimento pelo feedback entra junto na resposta.
- Nada é gravado no banco nesta etapa (conforme definido).

## Detalhes técnicos

Alterações apenas em `supabase/functions/whatsapp-webhook/index.ts`:

1. No prompt do sistema, adicionar uma seção de classificação de feedback, com exemplos positivos ("seria legal se", "sugestão:", "não está funcionando bem", "adorei o novo", "vocês deveriam") e negativos (mensagens que na verdade são lançamento/consulta).
2. Reaproveitar o intent existente `conversa` com um campo novo opcional `feedback_type` (`sugestao|elogio|critica|bug`), evitando criar caminho novo de execução e mantendo a validação de intents atual.
3. Regra explícita no prompt: mensagem classificada como feedback nunca vira `lancamento`; quando houver as duas coisas, prevalece a operação e o texto de resposta reconhece o feedback.
4. Texto de resposta padrão, no tom da EVA: agradecimento curto + confirmação de que a sugestão foi anotada para a equipe, sem prometer prazo.
5. Registrar o feedback apenas em log da edge function (`console.log`) para diagnóstico, sem persistência em tabela.

## Fora de escopo

- Chat da EVA dentro do app (permanece como está).
- Tabela de feedbacks e tela no EVA Hub.

## Mensagem de atualização aos usuários

O texto alegre já revisado será enviado como está.
