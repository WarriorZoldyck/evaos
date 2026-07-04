
## Objetivo
Impedir que mensagens ambíguas como `"Parcelado em 5x"` sejam classificadas como `editar_lancamento` e disparem a listagem dos 5 lançamentos recentes.

## Arquivo único: `supabase/functions/whatsapp-webhook/index.ts`

### 1. Corte de sessão no histórico enviado ao classificador (linhas 1034-1082)
Manter os 30 dias no banco (histórico completo continua salvo), mas separar o que é considerado "conversa em curso":
- Se a última mensagem anterior à atual tem mais de **60 minutos**, tratar como nova sessão: enviar só a mensagem atual + um bloco resumido curto (`[RESUMO — sessões anteriores encerradas]`) sem misturar lançamentos antigos como contexto ativo.
- Se está dentro dos 60 min, comportamento atual (lista integral dos últimos 30 + resumo).
- Isso elimina o gatilho de "pareceu continuação" quando o usuário volta depois de horas.

### 2. Endurecer a regra de `editar_lancamento` no prompt do sistema (linhas 1965-1979)
Substituir a regra vaga por gatilhos explícitos:
- **Só** classificar como `editar_lancamento` quando a mensagem contém verbo/expressão explícita de edição: `edita`, `edite`, `editar`, `muda`, `mude`, `mudar`, `troca`, `troque`, `altera`, `altere`, `corrige`, `corrige pra`, `na verdade era`, `era R$X não R$Y`, `apaga`, `exclui`, `remove`, `cancela esse último`, ou referência inequívoca a um lançamento anterior (`aquele lançamento`, `o último`, `essa despesa que criei`).
- Remover a regra atual de "mensagem curta 1-3 palavras após lançamento vira `editar_lancamento`" — hoje ela pega qualquer coisa; deixar aplicável **apenas** se a última mensagem do assistente foi confirmação de lançamento **e** ocorreu há menos de 10 min **e** o texto bate com nome de categoria/subcategoria conhecida.
- Adicionar exemplo negativo explícito: mensagens como `"Parcelado em 5x"`, `"3 vezes"`, `"no crédito"`, `"pix"`, `"amanhã"` NÃO são edições. Se vierem soltas (sem lançamento em andamento na sessão atual), classificar como `conversa` e perguntar a que compra se refere.

### 3. Guarda-corpo no código (linhas 3691-3712)
Quando o classificador ainda assim retornar `editar_lancamento` com `transaction_id=null` **e** a mensagem original do usuário não bater com nenhum dos verbos de edição da regra 2:
- Não listar os 5 recentes. Responder `conversa`: *"Não entendi bem — você quer editar algum lançamento ou criar um novo? Se for editar, me diga qual (nome ou nº na lista de Análises EVA)."*
- Só cair no fluxo "lista os 5 recentes" se o texto tiver verbo de edição explícito.

### 4. Log de diagnóstico
Adicionar `console.log` com `sessionAgeMinutes`, `messageText`, `matchedEditVerb` no branch de `editar_lancamento` para facilitar auditar casos futuros pelos logs de edge function.

## Escopo / não-impacto
- **Não** altera banco de dados nem esquema.
- **Não** mexe em criação de lançamentos, categorização, contexto, cartão, MDR, parcelas, ou lógica financeira.
- **Não** afeta o `eva-chat` (chat in-app) — só o WhatsApp.
- Histórico de 30 dias continua salvo integralmente; apenas o que vai no prompt do classificador respeita a janela de sessão.
- Aplica-se a todos os usuários (não só espclin).

## Verificação após implantar
1. Enviar `"Parcelado em 5x"` sem contexto → deve receber pergunta pedindo esclarecimento, não a lista.
2. Criar um lançamento e em seguida enviar `"muda pra 200"` em <10min → deve editar normalmente.
3. Criar um lançamento, esperar 2h, enviar `"muda pra 200"` → deve pedir para confirmar qual lançamento (com verbo de edição, cai no fluxo atual de listar os 5).
4. Enviar `"Alimentação"` logo após criar um lançamento (correção de categoria) → continua funcionando.

## Arquivos alterados
- `supabase/functions/whatsapp-webhook/index.ts` (apenas)
