

# Redesign da Pagina de Documentacao do EVA OS

## Objetivo
Transformar a pagina de documentacao de uma lista de cards colapsaveis em uma pagina de documentacao profissional com navegacao lateral (sidebar) e conteudo completo visivel, alem de adicionar uma nova secao dedicada a API do WhatsApp.

## Layout proposto

A pagina tera dois paineis:
- **Sidebar esquerda** (fixa, ~220px): lista de links de navegacao agrupados por categoria (Sistema, Cadastros, Relatorios, API/Integracoes)
- **Area de conteudo** (direita, scrollavel): todas as secoes renderizadas em sequencia com ancoras (`id`), como uma pagina de documentacao real (estilo docs)

Ao clicar em um item na sidebar, o scroll vai ate a secao correspondente. A secao ativa sera destacada na sidebar conforme o usuario scrolla (usando IntersectionObserver).

## Nova secao: API WhatsApp (EVA)

Sera adicionada uma secao completa documentando a API do webhook, incluindo:

1. **Visao geral** - Descricao da integracao WhatsApp com a EVA
2. **Endpoint e autenticacao** - URL, metodo POST, header `x-webhook-secret`
3. **Payload de request** - Campos `phone`, `message`, `image_base64`, `image_url` com tipos e obrigatoriedade
4. **Intencoes suportadas**:
   - `lancamento` - cria transacao (descricao dos campos retornados)
   - `consulta` - tipos: saldo, resumo_mes, gastos_mes, receitas_mes, pendentes, gastos_categoria
   - `conversa` - resposta conversacional
5. **Exemplos de request/response** - JSON formatado para cada intencao
6. **Codigos de erro** - 401, 400, 404, 500
7. **Configuracao** - Como cadastrar o numero no EVA OS e configurar o n8n/uazapi

## Estrutura de arquivos

- **Editar**: `src/pages/Docs.tsx` - reescrever completamente com o novo layout (sidebar + conteudo + secao API)

## Detalhes tecnicos

- Usar `useRef` + `IntersectionObserver` para highlight da secao ativa na sidebar
- Usar `scrollIntoView({ behavior: 'smooth' })` para navegacao
- Sidebar responsiva: no mobile vira um select/dropdown ou tabs horizontais no topo
- Blocos de codigo JSON estilizados com `bg-muted rounded-lg p-4 font-mono text-xs overflow-x-auto`
- Manter o mesmo design system (Card, Badge, Separator, etc.)
- Agrupar as secoes na sidebar:
  - **Inicio**: Visao Geral, Contextos
  - **Cadastros**: Contas, Categorias, Contatos
  - **Operacoes**: Lancamentos, Fatura de Cartao
  - **Relatorios**: Dashboard, Plano de Caixa, DRE
  - **Ferramentas**: Precificacao, Configuracoes
  - **API e Integracoes**: WhatsApp (EVA)

