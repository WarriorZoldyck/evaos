

## Implementar Tema Claro como Padrao + Alternancia de Tema

### Situacao Atual
- O app so tem tema escuro (dark mode hard-coded no CSS)
- A biblioteca `next-themes` ja esta instalada mas nao esta configurada como provider
- Todas as cores estao definidas como CSS variables em `index.css` (apenas um conjunto de cores escuras)

### O que sera feito

**1. Adicionar variaveis CSS para tema claro (light)**
- Criar um conjunto completo de variaveis CSS para o modo claro em `index.css`
- Manter as variaveis do modo escuro dentro de `.dark { ... }`
- O `:root` passara a ter as cores claras como padrao
- Cores claras: fundo branco/cinza claro, textos escuros, sidebar clara, cards brancos

**2. Configurar o ThemeProvider (next-themes)**
- Envolver o App com `<ThemeProvider>` usando `defaultTheme="system"` para herdar a preferencia do sistema operacional do usuario
- Atributo aplicado no `<html>` via classe (`class`)
- Armazenar a preferencia do usuario em `localStorage` para persistencia

**3. Criar botao de alternancia de tema**
- Adicionar um componente `ThemeToggle` no header do `AppLayout` (ao lado do `SidebarTrigger`)
- Icone de sol/lua com dropdown para 3 opcoes: Claro, Escuro, Sistema
- Estilo limpo e consistente com o design do app

### Arquivos que serao modificados/criados

| Arquivo | Acao |
|---|---|
| `src/index.css` | Modificar: reorganizar variaveis CSS para suportar light (`:root`) e dark (`.dark`) |
| `src/App.tsx` | Modificar: envolver com `ThemeProvider` do next-themes |
| `src/components/ThemeToggle.tsx` | Criar: componente com dropdown Sol/Lua/Sistema |
| `src/components/layout/AppLayout.tsx` | Modificar: adicionar `ThemeToggle` no header |

### Detalhes tecnicos

**Variaveis CSS (index.css)**
- `:root` (padrao = claro): backgrounds brancos (#ffffff, #f8fafc), textos escuros (#0f172a), borders cinza claro
- `.dark`: manter as cores atuais (azul marinho profundo, textos claros)
- Sidebar, cards, popovers, inputs - tudo tera variantes para ambos os temas

**ThemeProvider (App.tsx)**
- `attribute="class"` para usar classes CSS
- `defaultTheme="system"` para respeitar a preferencia do SO
- `enableSystem={true}` para detectar automaticamente
- `storageKey="eva-theme"` para persistir a escolha

**ThemeToggle**
- Dropdown com 3 opcoes: "Claro" (Sun icon), "Escuro" (Moon icon), "Sistema" (Monitor icon)
- Posicionado no header principal, visivel em todas as paginas internas

### Sobre os dados existentes

- Nenhuma alteracao no banco de dados sera necessaria
- Todas as 14 tabelas permanecem intactas
- Os 7 usuarios e seus dados (682 transacoes, 362 categorias, etc.) nao sao afetados
- As politicas RLS continuam funcionando normalmente
- A unica mudanca e visual (CSS + theme provider)
