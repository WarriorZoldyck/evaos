

# Chat IA In-App (Agente EVA)

## Visao Geral
Adicionar um botao flutuante no canto inferior direito que abre um chat com a EVA dentro do sistema. Ela tera as mesmas capacidades do WhatsApp: criar lancamentos, consultar dados, gerenciar categorias, aceitar imagens — tudo usando os dados do usuario logado.

## Arquitetura

### 1. Edge Function: `supabase/functions/eva-chat/index.ts`
- Reutiliza a **mesma logica de IA** do `whatsapp-webhook`: system prompt, resolucao de contexto, categorias, contas, padroes historicos, etc.
- Recebe `{ messages: [{role, content}], companyId?: string }` via POST com JWT do usuario autenticado
- Retorna streaming SSE (token-by-token) para resposta fluida
- Suporta imagens via base64 inline (multimodal)
- Executa acoes (criar transacao, consultar saldo, gerenciar categorias) no servidor usando `service_role` do Supabase
- Diferenca do WhatsApp: nao precisa de Evolution API, nao precisa de pending_actions (o chat pode usar confirmacao inline), retorna o JSON de acao + mensagem amigavel

### 2. Componente: `src/components/chat/EvaChatButton.tsx`
- Botao flutuante fixo no canto inferior direito (z-50) com icone da EVA
- Ao clicar, abre um painel/drawer de chat
- Badge de notificacao (opcional)

### 3. Componente: `src/components/chat/EvaChatPanel.tsx`
- Painel de chat com:
  - Header com nome "EVA" e botao fechar
  - Area de mensagens com scroll (renderiza markdown via `react-markdown`)
  - Input de texto + botao de enviar + botao de anexar imagem
  - Indicador de "digitando..." durante streaming
- Historico de mensagens mantido em estado local (useState) durante a sessao
- Streaming token-by-token usando SSE

### 4. Integracao no Layout: `src/components/layout/AppLayout.tsx`
- Adicionar `<EvaChatButton />` dentro do `AppLayoutInner`, apos `OnboardingGuide`

## Detalhes Tecnicos

### Edge Function — Fluxo
1. Valida JWT, extrai `user_id`
2. Busca contexto do usuario (categorias, contas, cartoes, empresas, contatos, transacoes recentes, padroes historicos) — mesmo codigo do whatsapp-webhook
3. Monta system prompt identico ao do WhatsApp (com todas as regras de contexto, categorias, etc.)
4. Envia para Lovable AI Gateway com streaming
5. Parseia a resposta JSON da IA
6. Executa a acao (insert transacao, consulta saldo, etc.) no Supabase
7. Retorna resultado como SSE stream ou JSON

### Frontend — Streaming
- Usa `fetch` com `ReadableStream` para ler SSE
- Acumula tokens e atualiza a mensagem do assistente em tempo real
- Suporte a imagens: converte arquivo para base64 e envia no array de mensagens

### Imagens
- Usuario seleciona imagem via input file
- Frontend converte para base64 e envia como parte do content (multimodal)
- Edge function envia para IA no formato `image_url` (mesmo do whatsapp-webhook)

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/functions/eva-chat/index.ts` | Criar — edge function com logica de IA + acoes |
| `supabase/config.toml` | Adicionar entrada `[functions.eva-chat]` |
| `src/components/chat/EvaChatButton.tsx` | Criar — botao flutuante + painel |
| `src/components/chat/EvaChatPanel.tsx` | Criar — interface de chat com streaming |
| `src/components/layout/AppLayout.tsx` | Editar — incluir `<EvaChatButton />` |
| `package.json` | Adicionar `react-markdown` como dependencia |

## Escopo da Primeira Versao
- Chat de texto com streaming
- Upload de imagem (1 por vez)
- Criar lancamentos
- Consultas (saldo, resumo, gastos, pendentes, listar)
- Gerenciar categorias
- Conversa livre
- Historico local da sessao (nao persiste entre reloads)

