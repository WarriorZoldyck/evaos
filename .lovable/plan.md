# Corrigir envio de arquivos no "Treinamento da EVA"

## O que encontrei
O envio falha porque o espaço que guarda esses arquivos nunca foi criado no banco. Existe um arquivo de configuração com essa criação, mas ele nunca foi aplicado. Por isso não há onde guardar o arquivo nem a lista de arquivos, e todo envio dá erro.

Também vi que, mesmo com o envio funcionando, a EVA (no WhatsApp e no chat do sistema) hoje não lê esses arquivos. O texto da tela diz que ela já usa os arquivos, mas isso ainda não acontece.

## O que vou fazer
1. Criar de verdade o espaço de arquivos e a lista de treinamento, com as mesmas regras de acesso de hoje: cada usuário vê e apaga só os próprios arquivos, e membros do Hub usam o espaço do dono.
2. Mostrar mensagens de erro claras na tela, sem termos técnicos, e limitar o tamanho de cada arquivo a 10 MB.
3. Fazer a EVA usar os arquivos: ao enviar, o sistema tira o texto do arquivo (PDF, TXT, CSV, DOCX) e guarda. A EVA recebe esse texto como base de conhecimento quando responde no chat e no WhatsApp, separado por Pessoal/Empresa. O selo muda de "Processando" para "Ativo" ou "Erro".
4. Testar enviando um PDF e um TXT e confirmar que o arquivo aparece na lista.

## Detalhes técnicos
- Migração: tabela `eva_knowledge` (+ `content text`, `error text`), com GRANTs para authenticated/service_role, RLS de dono e acesso para membros do Hub via `effectiveUserId`. Bucket privado `eva-knowledge` com políticas por pasta `{user_id}/`.
- Nova função no servidor `process-knowledge-file`: baixa do bucket, usa `extractDocumentText()` de `_shared/ai-provider.ts`, salva `content` e define status `active`/`error`.
- `eva-chat` e `whatsapp-webhook`: carregar o `content` dos arquivos ativos do contexto, até cerca de 20 mil caracteres, e incluir no prompt do sistema.
- `EvaTrainingCard.tsx`: status real, validação de tamanho, chamada do processamento após o envio, uso de `mapDatabaseError`.
