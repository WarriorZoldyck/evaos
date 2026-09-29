# EVA: prioridade ao treinamento do usuário e respostas objetivas

## Objetivo
Quando o usuário treinou a EVA com arquivos (Treinamento da EVA), ela deve:
1. Dar prioridade ao conteúdo desses arquivos ao responder — é a fonte principal.
2. Só depois complementar com dados do sistema (lançamentos, saldos, etc.), quando necessário.
3. Responder SOMENTE o que foi perguntado, sem puxar assunto.
4. Quando fizer sentido, oferecer no final algo como "quer que eu detalhe?" — mas sem entregar a informação extra antes de ser pedida.

## Mudança
Hoje o bloco de conhecimento é anexado ao final do prompt com uma instrução genérica ("use estas informações... não invente além delas"). Vou reescrever o texto de instrução em `supabase/functions/_shared/eva-knowledge.ts` para deixar explícito:

- **Prioridade**: a base de conhecimento do usuário (arquivos de treinamento) tem prioridade máxima. Se a resposta estiver nesses arquivos, responder com base neles. Dados do sistema servem apenas para complementar ou quando a pergunta for sobre os números do usuário.
- **Objetividade**: responder apenas o que foi perguntado, de forma direta. Não adicionar análises, resumos ou informações relacionadas que não foram pedidas.
- **Sugestão opcional**: ao final, no máximo uma pergunta curta oferecendo aprofundar (ex.: "Quer que eu mostre como isso fica nos seus números?"). Nunca entregar o aprofundamento sem o usuário pedir.
- **Fidelidade ao treinamento**: seguir as regras, preços e procedimentos como o usuário definiu nos arquivos, mesmo que difiram de padrões genéricos.

## Arquivos afetados
- `supabase/functions/_shared/eva-knowledge.ts` — novo texto de instrução do bloco (mudança única, vale para os dois canais).

## Publicação
- Reimplantar `eva-chat` e `whatsapp-webhook` (ambas importam o helper compartilhado).

## Verificação
- Confirmar que as duas funções implantam sem erro.
- Não farei pergunta real à EVA com conta de usuário; sugiro testar no WhatsApp/chat com uma pergunta coberta pelo arquivo de treinamento e conferir se a resposta segue o treinamento e fica objetiva.
