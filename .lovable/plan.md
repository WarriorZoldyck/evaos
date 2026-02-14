
## Recursos "Em Breve" no Menu Lateral

Adicionar 3 itens ao sidebar com badge "Em Breve" e uma pagina placeholder compartilhada para cada um. Ao clicar, o usuario vera uma pagina simples com titulo, descricao e um badge indicando que o recurso esta em desenvolvimento.

### Novos itens no menu

Uma nova secao **"Novidades"** no sidebar, abaixo de "Cadastros", com os seguintes itens:

| Item | Icone | Descricao na pagina |
|---|---|---|
| EVA Kids | GraduationCap | Educacao financeira para criancas. Em breve! |
| Metas | Target | Defina e acompanhe suas metas financeiras. |
| Precificacao V2 | TrendingUp | FHC completo com custo de vida pessoal integrado. |

Cada item tera um badge "Em breve" ao lado do nome no sidebar.

### Pagina placeholder

Uma unica pagina `ComingSoon.tsx` reutilizavel que recebe titulo e descricao via route state ou params. Exibira:
- Icone grande centralizado
- Titulo do recurso
- Descricao curta
- Badge "Em Breve"
- Visual limpo e consistente com o restante do app

### Arquivos alterados/criados

1. **`src/pages/ComingSoon.tsx`** (novo) -- Pagina placeholder reutilizavel
2. **`src/components/layout/AppSidebar.tsx`** -- Nova secao "Novidades" com os 3 itens e badge "Em breve"
3. **`src/App.tsx`** -- 3 novas rotas (`/eva-kids`, `/metas`, `/precificacao-v2`) apontando para `ComingSoon`

### Detalhes tecnicos

- Os itens do menu usarao um array separado `comingSoonItems` com uma flag `comingSoon: true`
- O badge sera um `<span>` pequeno com estilo de pill (fundo primary/10, texto primary, texto "Em breve")
- A pagina `ComingSoon` recebera `title` e `description` via props de rota (usando o elemento diretamente no App.tsx)
- Nenhuma alteracao no banco de dados
