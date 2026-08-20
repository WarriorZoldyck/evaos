# EVA com respostas analíticas (nível ChatGPT)

Hoje a EVA responde raso porque ela dá **uma tacada só**: um único chamado de IA classifica a mensagem e já escreve a resposta. Nesse momento ela ainda não tem número nenhum na mão — só listas de categorias e contas. Resultado: perguntas analíticas ("quanto preciso faturar bruto pra tirar 20k líquido?") caem no balde "conversa" e viram texto genérico do tipo "isso depende de vários fatores".

Também aparece o erro `contextName.toLowerCase is not a function` quando o usuário pede para avaliar **dois contextos juntos** ("implantes BR e Renato Bruggemann como se fossem uma empresa só") — o código só aceita um contexto por vez.

## O que vai mudar

**1. Duas etapas em vez de uma**
- Etapa 1 (rápida): a IA entende o pedido e diz *quais dados* precisa (período, contextos, categorias, tipo de análise) — não escreve mais a resposta final.
- Etapa 2 (analista): o backend busca os números reais e chama a IA de novo, agora **com os dados na mão**, para escrever uma resposta detalhada, com números, contas explicadas e recomendação prática.

**2. Perguntas analíticas deixam de virar "conversa"**
Novo tipo de pedido "análise", cobrindo:
- Quanto preciso faturar para tirar X líquido (usa custos fixos, variáveis e impostos reais do usuário)
- Comparações entre períodos e entre contextos
- Estrutura de custos / margem / ponto de equilíbrio
- Meta vs. realizado do mês (já existe, mas passa a vir com leitura, não só números)
- "Onde posso cortar X reais" com base nas maiores saídas

Quando faltar um dado essencial (ex.: regime tributário), a EVA faz **uma** pergunta objetiva e já mostra o cálculo com uma premissa marcada como estimativa — nunca devolve "não consigo te dar um número".

**3. Vários contextos na mesma pergunta**
Passa a aceitar lista de contextos ("Pessoal + Implantes BR"), consolidando os números. Isso corrige o erro que apareceu no print.

**4. Resposta com formato consistente**
Padrão: resposta direta primeiro (o número), depois a memória de cálculo, depois 2-4 recomendações. Markdown no chat do app; no WhatsApp, formatação enxuta com negrito e listas curtas.

**5. Mesma inteligência nos dois canais**
A lógica de análise fica compartilhada entre o chat dentro do app e o WhatsApp, para as respostas não divergirem.

## Detalhes técnicos

- Novo módulo `supabase/functions/_shared/eva-analysis.ts`: coleta de agregados (receitas/despesas por categoria e período, custos fixos vs variáveis, impostos, metas orçamentárias, saldos, cartões) e montagem do prompt de análise.
- `eva-chat/index.ts` e `whatsapp-webhook/index.ts`: novo intent `analise` com `analysis_type`, `contexts: string[]`, `period`, `target_amount`; segunda chamada ao Lovable AI Gateway com os dados agregados.
- `resolveContext` passa a `resolveContexts(input: string | string[])`, com normalização defensiva (aceita string, array ou null) — elimina o `toLowerCase is not a function`.
- Modelo: manter `google/gemini-2.5-pro` na etapa analítica (qualidade) e um modelo rápido na etapa de classificação; a etapa analítica retorna texto livre, sem JSON.
- Limite de dados: agregados (não linha a linha) para caber no contexto — até 24 meses de séries mensais e top 30 categorias.
- Tratamento de erro do gateway seguindo o padrão atual (402/429 com mensagem clara).

## Fora de escopo

- Novas telas no app.
- Persistência de histórico de análises.
