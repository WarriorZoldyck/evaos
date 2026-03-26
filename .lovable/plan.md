

# EVA Hub na Tela de Login

## Problema
O EVA Hub so esta acessivel pelo sidebar apos login. O plano original previa que membros do Hub (e donos) pudessem acessar o EVA Hub direto na tela de login, antes de entrar no sistema.

## O que fazer

### Auth.tsx — Adicionar terceira aba "EVA Hub"

Na tela de login (`/auth`), mudar o `TabsList` de 2 para 3 colunas:
- **Entrar** (login normal → dashboard)
- **Cadastrar** (signup)
- **EVA Hub** (login → redireciona para `/eva-hub`)

A aba "EVA Hub" mostra o mesmo formulario de login (email + senha), mas ao autenticar com sucesso, redireciona para `/eva-hub` em vez de `/dashboard`.

Na pratica: criar um `HubLoginForm` que reutiliza a logica do `LoginForm`, mas apos `signIn` com sucesso, faz `navigate("/eva-hub")` em vez de depender do redirect padrao para `/dashboard`.

### AppLayout.tsx — Redirect automatico para membros Hub

Isso ja existe parcialmente (linha que verifica `isHubMember && !impersonatingOwnerId`). Garantir que membros Hub que fazem login normal sejam sempre redirecionados para `/eva-hub` primeiro.

## Arquivo afetado
| Arquivo | Acao |
|---------|------|
| `src/pages/Auth.tsx` | Adicionar aba "EVA Hub" com login que redireciona para `/eva-hub` |

