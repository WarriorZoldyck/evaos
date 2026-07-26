## Sidebar: um único glass + item ativo neumórfico + dark mode

### Mudanças

**1. Um único container glass envolvendo todos os grupos**
- Em `src/components/ui/sidebar.tsx` (`SidebarContent`, linha 328): adicionar classe `sidebar-content-glass`.
- Em `SidebarGroup` (linha 343): remover a classe `sidebar-group-glass`.
- Em `src/index.css`: substituir `.sidebar-group-glass` (que criava um cartão por grupo) por `.sidebar-content-glass` — um único painel glass com bordas arredondadas, blur/saturate, borda clara translúcida e sombra suave, aplicado ao container que envolve toda a lista de grupos. Separadores entre grupos ficam como uma linha `hr` sutil (`sidebar-group-label` já demarca visualmente cada seção).

**2. Item ativo neumórfico (mesmo idioma do NeuToggle)**
- Reescrever `.sidebar-item-active` em `src/index.css`:
  - Fundo `#ecf0f3` (mesma base do toggle) em vez do gradiente azul atual.
  - Sombra composta idêntica em espírito ao toggle: `-6px -3px 6px rgba(255,255,255,0.9), 6px 3px 10px rgba(209,217,230,0.9)` para o efeito "elevado".
  - Texto e ícone em azul EVA (`hsl(199 100% 36%)`) para manter identidade.
  - Remover a faixa `inset 3px 0 0` e o gradiente azul; profundidade agora vem só da sombra.
- Ajustar `.sidebar-item` para ser transparente por padrão (sem `background`/`border` brancos) para não competir com o glass.

**3. Dark mode**
- `.dark .sidebar-content-glass`: fundo com tint azul escuro translúcido `hsl(215 35% 12% / 0.55)` (não cinza), borda `hsl(210 30% 40% / 0.3)`, sombra escura.
- `.dark .sidebar-item-active`: base `hsl(215 30% 14%)` com sombras neumórficas escuras (`inset` claro sutil + outer escuro), texto/ícone em ciano EVA (`hsl(190 90% 65%)`).
- Remover o bloco `.dark .sidebar-group-glass` antigo (não usado mais).

### Fora do escopo
- Não altera lógica de detecção de rota ativa, colapso, `NavLink`, ou pill "Pessoal".
- Não mexe em outras superfícies (`.eva-surface`, cards do dashboard, header).

### Verificação
- Preview desktop expandido: um único painel glass claro envolvendo todos os grupos; item ativo destaca-se como um botão "elevado" estilo macOS/neumorphism.
- Colapsado: mesmo painel único, itens ativos ainda visíveis como pastilha elevada.
- Dark mode: painel azul-escuro translúcido (não cinza), item ativo com relevo escuro coerente.
