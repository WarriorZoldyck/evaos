

## Integracao WhatsApp com EVA - Lancamentos e Consultas

O usuario podera enviar fotos de notas fiscais, comandos de lancamento e tambem **perguntas sobre seus dados** pelo WhatsApp. A EVA (IA) identifica a intencao e responde adequadamente.

### Arquitetura

```text
Usuario (WhatsApp)
    |
    v
  uazapi --> n8n --> Edge Function (whatsapp-webhook)
    ^                      |
    |                      v
    +--- resposta <--- IA classifica intencao:
                        |
                        +-- "lancamento" --> cria transacao no DB
                        |
                        +-- "consulta"  --> busca dados no DB
                        |
                        +-- "conversa"  --> resposta generica
```

O n8n tem papel simples: recebe do uazapi, repassa para o webhook, devolve a resposta para o uazapi. **Toda a inteligencia fica na Edge Function.**

---

### O que sera feito

#### 1. Campo de WhatsApp nas Configuracoes

A tabela `profiles` ja possui a coluna `whatsapp_number`. Adicionar um card na pagina de Configuracoes para o usuario cadastrar seu numero (formato: 5511999999999).

**Arquivo**: `src/pages/Configuracoes.tsx`
- Novo card "WhatsApp" entre o card de Empresas e o de Campos do Formulario
- Campo de input com mascara para telefone
- Botao "Salvar" que atualiza `profiles.whatsapp_number`
- Feedback visual (toast) ao salvar

#### 2. Edge Function `whatsapp-webhook`

Endpoint unico que o n8n chama com os dados da mensagem recebida.

**Arquivo**: `supabase/functions/whatsapp-webhook/index.ts`

**Payload recebido do n8n:**
```text
{
  "phone": "5511999999999",
  "message": "texto da mensagem",
  "image_base64": "base64 da imagem (se houver)",
  "image_url": "URL da imagem (alternativa)"
}
```

**Fluxo interno:**

1. Valida token secreto no header (seguranca)
2. Busca usuario pelo `whatsapp_number` na tabela `profiles`
3. Se nao encontrar, retorna erro "numero nao cadastrado"
4. Envia mensagem + imagem para a IA (Gemini) com um prompt que:
   - Classifica a intencao: "lancamento", "consulta" ou "conversa"
   - Para lancamentos: extrai descricao, valor, data, tipo, categoria
   - Para consultas: identifica o tipo de consulta (saldo, resumo, pendentes, etc.)
5. Executa a acao correspondente

**Tipos de consulta suportados:**

| Exemplo de mensagem | Acao |
|---------------------|------|
| "Qual meu saldo?" | Busca saldo de todas as contas (bank_accounts + wallets) usando a funcao `get_account_balance` |
| "Quanto gastei esse mes?" | Soma transacoes tipo despesa do mes atual com status Pago |
| "Quanto recebi esse mes?" | Soma transacoes tipo receita do mes atual com status Pago |
| "Resumo do mes" | Retorna receitas, despesas, saldo e top 3 categorias |
| "Quais minhas contas pendentes?" | Lista transacoes com status Pendente ordenadas por data |
| "Quanto gastei com alimentacao?" | Filtra despesas por categoria |

Para consultas, a Edge Function usa o `service_role_key` com filtro de `user_id` para garantir isolamento dos dados.

**Resposta da Edge Function:**
```text
{
  "success": true,
  "intent": "consulta",
  "message": "Seu saldo total e de R$ 5.230,00\n\nContas:\n- Nubank: R$ 3.200,00\n- Itau: R$ 2.030,00",
  "transaction": null
}
```

Para lancamentos:
```text
{
  "success": true,
  "intent": "lancamento",
  "message": "Lancamento criado: Supermercado Extra - R$ 157,30 (Despesa/Alimentacao)",
  "transaction": {
    "description": "Supermercado Extra",
    "amount": 157.30,
    "type": "despesa",
    "category": "Alimentacao",
    "date": "2026-02-23"
  }
}
```

#### 3. Secret para Gemini API

A Edge Function precisa de uma chave da API do Google Gemini para processar imagens e texto.

- Secret: `GEMINI_API_KEY`
- Sera solicitada ao usuario antes de criar a funcao

#### 4. Secret para seguranca do webhook

Um token secreto que o n8n envia no header para autenticar as chamadas.

- Secret: `WHATSAPP_WEBHOOK_SECRET`
- O n8n deve enviar como header: `x-webhook-secret: <token>`
- A Edge Function valida antes de processar

#### 5. Atualizacao do config.toml

```text
[functions.whatsapp-webhook]
verify_jwt = false
```

---

### Prompt da IA (Gemini)

O prompt enviado para a IA tera 3 partes:

**1. Instrucoes do sistema:**
- Voce e a EVA, assistente financeira
- Classifique a mensagem como: lancamento, consulta ou conversa
- Para lancamentos, extraia os campos estruturados
- Para consultas, identifique o tipo de informacao solicitada
- Responda sempre em portugues brasileiro

**2. Contexto do usuario:**
- Lista de categorias do usuario (buscadas do banco)
- Lista de contas bancarias do usuario
- Data atual

**3. Mensagem do usuario:**
- Texto e/ou imagem

A IA retorna um JSON estruturado com a intencao e os dados extraidos.

---

### Arquivos envolvidos

| Arquivo | Acao |
|---------|------|
| `src/pages/Configuracoes.tsx` | Adicionar card para cadastrar numero WhatsApp |
| `supabase/functions/whatsapp-webhook/index.ts` | Nova Edge Function |
| `supabase/config.toml` | Registrar nova funcao |

### Consideracoes

- Transacoes criadas via WhatsApp: status "Pago", sem company_id, conta bancaria inferida (unica) ou nula (varias)
- Categorias sugeridas pela IA com base nas categorias existentes do usuario
- A IA tenta responder consultas com dados reais do banco, nunca inventa numeros
- Se a IA nao conseguir interpretar a mensagem, retorna uma resposta amigavel pedindo mais detalhes
- Rate limiting nao implementado na primeira versao, mas pode ser adicionado depois

### Fluxo do n8n (referencia para o usuario configurar fora do Lovable)

1. **Trigger**: Webhook do uazapi (mensagem recebida)
2. **HTTP Request**: POST para a URL do webhook com phone, message, image
3. **Condicional**: Se success = true, enviar `response.message` de volta pelo uazapi
4. **Erro**: Se success = false, enviar mensagem generica de erro

