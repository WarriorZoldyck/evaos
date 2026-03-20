
## Aprimorar memória e inteligência da EVA no WhatsApp

### O que encontrei
- Hoje a memória conversacional da EVA está curta: ela busca só **3 horas**, até **80 mensagens**, e resume o que passa de 20 mensagens.
- Para decisão de categoria, ela só manda para a IA **5 lançamentos recentes**, o que é muito pouco para reconhecer padrões de fornecedor/estabelecimento.
- Nos logs e histórico do Renato apareceram falhas repetidas:
  - **Dentais** no contexto `RENATO BRUGGEMANN` caiu em “não encontrei categoria”, embora a categoria exista.
  - **Empório Moscato** já tinha histórico em `Supérfulos`, mas a EVA sugeriu criar categoria nova.
  - **Lanchonete/doceria** também caiu em criação de categoria, sinal de que a IA está “renomeando o estabelecimento” em vez de reaproveitar a taxonomia existente.
- O problema principal não parece ser só “mais memória de chat”; falta uma **memória operacional de lançamentos anteriores**, por estabelecimento/descrição/categoria/contexto.

### Abordagem recomendada
Em vez de deixar “permanente” agora, eu implementaria uma solução em 3 camadas, mais segura e mais útil:

1. **Aumentar a janela de conversa**
   - Trocar de `3 horas / 80 mensagens` para algo como **30 dias / 300-500 mensagens**, com resumo progressivo.
   - Isso ajuda a EVA lembrar correções, respostas e padrões recentes do cliente.

2. **Adicionar memória de lançamentos históricos para a IA**
   - Antes de chamar a IA, buscar um conjunto de **lançamentos anteriores relevantes** do usuário, por exemplo:
     - últimos **90 dias**
     - limite controlado, ex. **50-100 lançamentos**
   - Montar no prompt um bloco tipo:
     - estabelecimento/fornecedor
     - descrição usada antes
     - categoria/subcategoria usada antes
     - contexto
     - forma de pagamento
     - conta/cartão
   - Assim a EVA passa a decidir com base no comportamento real do cliente, não só na imagem atual.

3. **Criar uma etapa de “reuso inteligente” antes de abrir confirmação**
   - Antes de cair em `suggested_category_name` / “quer que eu crie a categoria?”, rodar uma heurística no servidor:
     - comparar descrição extraída + `contact_name` + fornecedor/cliente + histórico recente
     - se houver forte similaridade com lançamentos passados no mesmo contexto, **reusar automaticamente** a categoria já usada
   - Isso deve reduzir bastante os falsos pedidos de criação de categoria.

### Mudanças previstas
#### 1) Memória da conversa
No `supabase/functions/whatsapp-webhook/index.ts`:
- alterar a consulta de `whatsapp_messages`
- hoje: 3 horas / 80 mensagens
- novo plano:
  - usar **30 dias** como padrão
  - limitar o volume bruto
  - manter resumo progressivo para não explodir tokens

#### 2) Memória histórica de lançamentos
Ainda no webhook:
- buscar histórico adicional em `transactions`
- enriquecer com:
  - nome da categoria resolvido
  - contexto (`Pessoal` ou empresa)
  - contato/fornecedor/cliente
  - descrição
  - payment method
- injetar isso no prompt como bloco explícito do tipo:
  - “Padrões históricos do usuário”
  - “Se estabelecimento semelhante já foi lançado antes, priorize a mesma categoria/contexto”

#### 3) Reuso automático de categoria
Adicionar lógica antes do bloco `NO CATEGORY MATCH`:
- normalizar nomes (`Empório Moscato`, `EMPORIO MOSCATO`, etc.)
- comparar com:
  - `contact_name`
  - fornecedor
  - descrição de lançamentos passados
- se houver correspondência forte:
  - preencher `matchedCategory`
  - opcionalmente reaproveitar `supplier_id/client_id`
- só perguntar para criar categoria quando realmente não houver sinal confiável.

#### 4) Reforço de prompt
Ajustar o prompt para deixar claro:
- estabelecimento não é categoria
- se já houver histórico semelhante, a EVA deve priorizar a categoria anteriormente usada
- nomes como “Empório”, “Lanchonete”, “Doceria”, “Restaurante” não devem virar categoria automaticamente se o histórico apontar outra classificação consolidada.

### Arquivo principal
- `supabase/functions/whatsapp-webhook/index.ts`

### Resultado esperado
Depois disso, a EVA deve:
- lembrar melhor o que o Renato já corrigiu nos últimos dias
- reaproveitar categorias já usadas para o mesmo fornecedor/estabelecimento
- parar de pedir criação de categoria quando já existe padrão histórico suficiente
- manter o acerto de contexto pessoal/empresa sem regredir

### Observação técnica
Eu **não recomendaria memória “permanente” só via histórico bruto de chat**, porque isso aumenta custo, ruído e risco de decisões piores. O melhor ganho aqui vem de:
- **30 dias de conversa**
- mais **memória estruturada de lançamentos**
- mais **heurística de reaproveitamento antes da IA errar**

### Prioridade de implementação
1. Expandir memória de conversa para 30 dias
2. Injetar histórico de lançamentos relevantes no prompt
3. Fazer fallback automático de categoria por similaridade/histórico
4. Refinar logs para mostrar quando houve “category reuse from history”

