Verifiquei a integração EVA WhatsApp em modo somente leitura.

Constatações atuais:
- A Edge Function `whatsapp-webhook` está publicada e responde corretamente a uma chamada de healthcheck.
- Os secrets necessários existem: Evolution API, Supabase, Lovable API e webhook secret.
- Existem 4 perfis com número de WhatsApp cadastrado.
- Não há mensagens processadas nas últimas 24h.
- A última mensagem gravada em `whatsapp_messages` é de 23/04/2026.
- Os logs recentes da `whatsapp-webhook` só mostram o meu healthcheck; não há chamadas recentes vindas da Evolution API.
- A função auxiliar `evolution-webhook-config` está retornando 401 no teste, porque exige usuário autenticado no preview; não consegui consultar a configuração atual da Evolution por ela nesta sessão.

Diagnóstico provável:
A lógica principal da EVA WhatsApp parece disponível, mas a Evolution API provavelmente não está entregando eventos para o webhook atualmente, ou o webhook da instância não está configurado/apontando para a URL correta.

Plano para corrigir:
1. Fortalecer a autenticação do webhook
   - Reativar/confirmar validação do header `x-webhook-secret` dentro da `whatsapp-webhook`, alinhando com a documentação do app.
   - Garantir que requisições inválidas retornem 401 sem processar payloads.

2. Corrigir a configuração automática da Evolution
   - Ajustar `evolution-webhook-config` para configurar o webhook usando a URL correta do projeto via variável de ambiente, evitando URL hardcoded.
   - Incluir suporte ao header/secret esperado pela `whatsapp-webhook`, se a Evolution API permitir headers/customização no payload.
   - Melhorar logs e respostas para mostrar claramente se o webhook foi configurado ou se a Evolution rejeitou a configuração.

3. Adicionar um teste/endpoint de diagnóstico seguro
   - Criar uma resposta de diagnóstico autenticada para validar: secrets presentes, webhook acessível, bucket de anexos, perfis com WhatsApp e últimas mensagens.
   - Evitar expor valores de secrets; mostrar apenas `SET/MISSING`.

4. Validar o fluxo após ajustes
   - Testar `whatsapp-webhook` com evento `messages.upsert` ignorado (`fromMe`) para confirmar disponibilidade.
   - Testar bloqueio de chamadas sem secret, caso a validação seja ativada.
   - Consultar logs da função para confirmar recebimento e processamento.
   - Se possível, chamar `evolution-webhook-config` autenticado para configurar a instância e depois verificar se novas mensagens chegam.

5. Pontos que dependem de acesso externo/conta
   - Se a Evolution API não permitir setar o header `x-webhook-secret`, será necessário escolher entre: usar webhook sem header secreto e validar por outro mecanismo, ou configurar o header diretamente no painel/instância da Evolution.
   - Se o usuário não estiver autenticado no preview, a função `evolution-webhook-config` continuará retornando 401 para chamadas feitas como usuário final.

Resultado esperado:
- EVA WhatsApp volta a receber eventos da Evolution.
- Mensagens recentes voltam a aparecer em `whatsapp_messages`.
- Falhas de configuração ficam visíveis nos logs/resposta diagnóstica.
- Webhook fica protegido contra chamadas não autorizadas.