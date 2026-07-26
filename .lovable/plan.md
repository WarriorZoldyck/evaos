
## Objetivo

Elevar apenas o **visual** da sidebar com **Glass Neumorphism discreto** (referências: macOS/iOS, Linear, Arc, Raycast), preservando 100% da estrutura, lógica, estados, hooks, rotas, permissões, responsividade e Dark Mode atuais.

## Restrições (obrigatórias)

- Não alterar regras de negócio, estados, hooks, rotas, permissões.
- Não alterar componentes internos do shadcn/ui.
- Não criar componentes, não instalar libs, não adicionar SVG, não usar Framer Motion.
- Não substituir componentes nem mudar comportamento do menu.
- Não modificar Dark Mode nesta etapa.
- **Nunca remover** classes Tailwind existentes — somente **acrescentar** classes novas.
- **Preservar o padrão atual de detecção de ativo.** O projeto usa o wrapper custom `src/components/NavLink.tsx` que aceita `className`/`activeClassName` e internamente mapeia para o render-prop `isActive` do React Router v6. **Continuar usando `activeClassName`** nos `NavLink`s da sidebar. Se aparecer algum `<RouterNavLink>` puro, usar `className={({ isActive }) => cn("classes atuais", "sidebar-item", isActive && "sidebar-item-active")}` — **nunca introduzir `activeClassName` em `RouterNavLink`**.
- Em caso de conflito de estilo, **ajustar apenas a especificidade** via `@layer components` (ou seletor mais específico como `.sidebar-glass .sidebar-item`) — **jamais remover** classes Tailwind existentes.

## Direção visual (guardrail estético)

O resultado deve parecer **evolução natural** da interface atual — o usuário reconhece imediatamente o EVA Finance Hub, apenas com acabamento mais refinado e premium. **Evitar contraste excessivo** entre sidebar e o restante da aplicação. Efeito **elegante, discreto e consistente** com software financeiro profissional. Blur suave, sombras leves, transparências sutis. Sem "wow futurista".

## Escopo (somente 2 arquivos)

- `src/index.css` — tokens + classes novas em `@layer components`.
- `src/components/layout/AppSidebar.tsx` — apenas **append** de classes.

Qualquer outro arquivo permanece intocado.

## Paleta

- Base: `#F2F5FA`
- Primária EVA: `#00B4D8`
- Gradiente ativo: `#EAF8FF → #D9F3FF`
- Texto/ícone ativo: `#0077B6`

## Design tokens novos em `:root` (index.css)

```text
--glass-surface        : 210 33% 96%     /* ~#F2F5FA */
--glass-border         : 0 0% 100% / .6
--neu-light            : 255 255 255 / .9
--neu-dark             : 210 25% 78% / .5
--sidebar-active-from  : 198 100% 96%    /* ~#EAF8FF */
--sidebar-active-to    : 198 100% 92%    /* ~#D9F3FF */
--sidebar-active-fg    : 199 100% 36%    /* ~#0077B6 */
```

Dark mode sem override. As classes novas só têm efeito no light; no `.dark` os estilos atuais permanecem íntegros.

## Classes novas (em `@layer components`, index.css)

- **`.sidebar-glass`** — fundo `hsl(var(--glass-surface) / .78)`, `backdrop-filter: blur(5px) saturate(1.05)` (com prefixo `-webkit-`), borda direita translúcida, sombra externa suave e highlight interno.
- **`.sidebar-item`** — `border-radius: 12px`, transição 180ms; hover com `translateY(-1px)` e relevo neumórfico leve.
- **`.sidebar-item-active`** — gradiente `--sidebar-active-from → --sidebar-active-to`, `color: hsl(var(--sidebar-active-fg))`, `box-shadow` inset duplo + linha inferior de brilho; regra escopada `.sidebar-item-active svg { color: hsl(var(--sidebar-active-fg)); }`.
- **`.sidebar-context-pill`** — mesma base glass, borda translúcida, sombra dupla suave; **sem alterar** comportamento do dropdown.
- **`.sidebar-group-label`** — `color: hsl(215 15% 55%); letter-spacing: .08em; font-weight: 600`.
- **`.sidebar-badge-soft`** — apenas polimento de sombra em badges existentes; **cores originais preservadas**.

Todas usam somente `background`, `border`, `box-shadow`, `backdrop-filter`, `transition`, `transform`. Zero JS.

## Edições em `AppSidebar.tsx` (apenas append)

Sem remover nada. Acrescentar as classes indicadas ao lado das existentes:

1. `<Sidebar …>` → adicionar `sidebar-glass`.
2. Botão do dropdown de contexto → adicionar `sidebar-context-pill`.
3. Cada `<NavLink …>` (Principal, Financeiro, Cadastros, EVA Hub, Novidades, Footer):
   - `className`: adicionar `sidebar-item`.
   - `activeClassName`: adicionar `sidebar-item-active`.
4. `<SidebarMenuButton onClick={signOut} …>` (Sair) → adicionar `sidebar-item` (hover destructive atual continua funcionando).
5. Cada `<SidebarGroupLabel …>` → adicionar `sidebar-group-label`.
6. Badges numéricos (Análises EVA, EVA Hub, "Em breve") → adicionar `sidebar-badge-soft`.

## Critério de não regressão (checklist antes de concluir)

Antes de encerrar a implementação, confirmar cada item:

- [ ] Nenhum comportamento da sidebar foi alterado (colapso `icon`, tooltips, dropdown de contexto com checkboxes, navegação, logout, badges de contagem).
- [ ] Nenhuma classe Tailwind existente foi removida ou substituída — apenas **acrescentadas** novas classes.
- [ ] Nenhum componente foi substituído (Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarMenuButton, NavLink wrapper, DropdownMenu etc. permanecem exatamente os mesmos).
- [ ] Nenhuma lógica foi modificada (nenhum `useEffect`, hook, handler, contexto, permissão, plano ou role tocado).
- [ ] Apenas `src/index.css` e `src/components/layout/AppSidebar.tsx` foram alterados. Nenhum outro arquivo.
- [ ] Dark Mode permanece visualmente idêntico ao atual (nenhum override em `.dark`).
- [ ] Nenhum pacote novo instalado; sem SVG novo; sem Framer Motion.
- [ ] Se em algum momento uma alteração estrutural parecer necessária (mudar componente, mudar hook, mexer em outro arquivo, remover classe existente), **interromper a implementação e explicar o motivo** em vez de prosseguir.

## Próximas etapas (fora desta rodada)

Depois da sidebar aprovada, seguimos em ordem: Header → Cards → Inputs → Tabelas → Modais → Botões → Badges → Charts → micro animações. Cada etapa em um plano próprio, para manter consistência visual em toda a aplicação.

## Entregáveis

- `src/index.css`: +~50 linhas (tokens + 6 classes em `@layer components`).
- `src/components/layout/AppSidebar.tsx`: apenas concatenações de className em ~10 pontos.
