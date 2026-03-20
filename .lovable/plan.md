

## Otimizar conversa da EVA no WhatsApp — contexto e inteligência

### Problemas identificados

Analisei o código completo do webhook e identifiquei 4 problemas que fazem a EVA parecer "burra" e repetitiva:

1. **Histórico limitado a 50 mensagens do dia** — Em conversas ativas, 50 mensagens se esgotam rápido. Mensagens mais antigas (com contexto importante) são descartadas. Além disso, à meia-noite o contexto zera completamente.

2. **System prompt gigantesco** — O prompt do sistema inclui TODAS as categorias, contas, cartões, fornecedores, clientes e lançamentos recentes. Isso consome uma parcela enorme da janela de contexto da IA, deixando pouco espaço para o histórico da conversa realmente importar.

3. **Sem sumarização** — As 50 mensagens são enviadas integralmente como texto bruto. Mensagens repetidas ou irrelevantes (como confirmações "sim"/"não") ocupam o mesmo espaço que mensagens ricas em contexto.

4. **Falha silenciosa no parse** — Quando a IA retorna texto puro (sem JSON), o sistema responde "não entendi" sem aproveitar a resposta que a IA já gerou — forçando o usuário a repetir.

### Solução (4 partes)

#### 1. Expandir janela de histórico (últimas 3 horas, não só hoje)
- Trocar filtro de "hoje" para **últimas 3 horas** (mais relevante que meia-noite)
- Aumentar limite de 50 para **80 mensagens**
- Manter as **últimas 20 mensagens integrais** e **sumarizar as anteriores** em um bloco compacto antes de enviar à IA

#### 2. Sumarizar mensagens antigas automaticamente
- Pegar mensagens do histórico além das últimas 20
- Condensar em um resumo de contexto: "O usuário pediu X, a EVA respondeu Y, depois o usuário corrigiu para Z"
- Enviar esse resumo como primeira mensagem do `conversationHistory`, seguido das 20 mensagens mais recentes
- Isso preserva o contexto sem estourar o token budget

#### 3. Compactar o system prompt
- Só incluir categorias e contas do **contexto ativo** (Pessoal ou empresa que o usuário está usando)
- Limitar lançamentos recentes a **5** em vez de 10
- Remover campos verbose do prompt (ex: regras redundantes que se repetem)

#### 4. Aproveitar respostas da IA que não são JSON
- Quando o `JSON.parse` falhar, verificar se a resposta contém texto útil (não-vazio)
- Se sim, enviar esse texto diretamente como `friendly_message` em vez de "não entendi"
- Isso evita que o usuário repita a pergunta quando a IA já respondeu corretamente mas não formatou como JSON

### Detalhes técnicos

**Arquivo modificado:** `supabase/functions/whatsapp-webhook/index.ts`

**Mudanças específicas:**

```text
Antes:
  - .gte("created_at", todayStart.toISOString())
  - .limit(50)
  - conversationHistory enviado integralmente
  - JSON.parse falha → "não entendi"

Depois:
  - .gte("created_at", threeHoursAgo.toISOString())
  - .limit(80)
  - mensagens 1-60 → resumo compacto via IA
  - mensagens 61-80 → enviadas integralmente
  - JSON.parse falha → usa texto da IA como resposta direta
  - System prompt: categorias filtradas por contexto frequente
```

**Sumarização:** Feita localmente no código (sem chamada extra à IA), concatenando pares user/assistant em formato "Usuário perguntou X → EVA respondeu Y" para as mensagens mais antigas.

### Resultado esperado
- EVA mantém contexto de conversas longas sem se repetir
- Respostas mais rápidas (menos tokens no prompt)
- Sem "não entendi" quando a IA já deu a resposta certa
- Transição suave entre assuntos na mesma conversa

