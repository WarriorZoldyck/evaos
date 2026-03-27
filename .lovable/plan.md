

# EVA Hub — Redesenho Completo da Experiência

## Problema
A aba "EVA Hub" na tela de login é apenas um clone do formulário de login normal. O EVA Hub precisa ser uma **experiência totalmente diferente** — após o login via aba Hub, o usuário entra num painel dedicado com visão da empresa, membros convidados, e possibilidade de criar áreas de trabalho/departamentos.

## O que muda

### 1. Tela de Login (Auth.tsx) — Manter simples
A aba "EVA Hub" continua com o formulário de login (email+senha), mas com **visual e textos diferenciados** — título "Acesse seu Hub", descrição explicando que é a área de gestão de equipe. Após login, redireciona para `/eva-hub`.

### 2. Página EVA Hub (EvaHub.tsx) — Redesenho total

**Para o DONO (usuário normal que tem membros ou quer gerenciar):**

Layout em seções:

- **Header**: Nome da conta/empresa do dono, descrição, avatar
- **Seção "Áreas de Trabalho"**: O dono pode criar departamentos/áreas (ex: "Financeiro", "Comercial"). Cada área é um agrupamento lógico. Novo conceito — tabela `workspaces`.
- **Seção "Membros"**: Lista de membros com role, status, e a qual área de trabalho pertencem
- **Ações**: Convidar membro, criar área de trabalho, gerenciar permissões

**Para o MEMBRO (hub_member=true):**
- Tela de seleção mostrando as áreas de trabalho disponíveis com nome da empresa/conta do dono
- Botão "Entrar" para impersonar

### 3. Nova tabela `workspaces`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| owner_id | uuid NOT NULL | Dono da conta |
| name | text NOT NULL | Ex: "Financeiro", "Comercial" |
| description | text | Descrição da área |
| created_at | timestamptz | |

- RLS: owner pode CRUD, membros podem SELECT (via workspace_members linkado)
- Coluna `workspace_id` opcional em `workspace_members` para associar membro a uma área

### 4. Buscar dados do perfil do dono

Na seção header do Hub, buscar `profiles.full_name` e `companies` do dono para mostrar nome e empresas cadastradas.

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabela `workspaces` + add `workspace_id` em `workspace_members` |
| `src/pages/EvaHub.tsx` | Redesenho total — layout com seções: perfil, áreas de trabalho, membros |
| `src/hooks/useWorkspaceMembers.ts` | Adicionar CRUD de workspaces |
| `src/pages/Auth.tsx` | Ajustar textos/visual da aba Hub (não clonar login) |

## Detalhes técnicos

```text
OWNER VIEW (EvaHub.tsx):
┌─────────────────────────────────────────────┐
│  👤 Nome do Dono                            │
│  Empresa: Nome da Empresa | CNPJ            │
│  ──────────────────────────────────────────  │
│                                              │
│  📂 Áreas de Trabalho          [+ Criar]    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │Financeiro│ │Comercial │ │ Operações│    │
│  │ 2 membros│ │ 1 membro │ │ 0 membros│    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                              │
│  👥 Membros                  [+ Convidar]   │
│  ┌─ João Silva ─── Editor ─── Financeiro ─┐ │
│  ┌─ Maria ─── Viewer ─── Comercial ──────┐ │
└─────────────────────────────────────────────┘

MEMBER VIEW:
┌─────────────────────────────────────────────┐
│  EVA Hub — Selecione sua área de trabalho   │
│                                              │
│  ┌─ Empresa XYZ ─── Financeiro ─── Entrar ┐│
│  ┌─ Empresa ABC ─── Comercial ─── Entrar  ┐│
└─────────────────────────────────────────────┘
```

