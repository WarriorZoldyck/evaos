## Ajustar glassmorphism dos grupos da sidebar

### Problemas atuais
1. Com fundo branco por trás, o cartão glass do grupo quase não aparece — falta contraste (tint muito claro, sombra suave demais).
2. No estado colapsado (`collapsible=icon`, largura ~48px), o cartão de grupo com `margin: 6px 8px` + `padding` + `border-radius: 14px` fica apertado/quebrado: sobra pouco espaço para os ícones, a borda arredondada corta o hover dos itens, e o highlight `::before` fica desalinhado.

### Ajustes propostos (somente CSS em `src/index.css`, classe `.sidebar-group-glass`)
- **Mais contraste** no light mode:
  - Tint com leve toque azul EVA em vez de branco puro: gradiente de `hsl(200 40% 96% / 0.7)` → `hsl(210 30% 92% / 0.45)`.
  - Borda mais visível: `hsl(210 25% 82% / 0.7)`.
  - Sombra externa mais presente: `0 8px 24px -14px hsl(var(--neu-dark) / 0.8)` + halo sutil `0 0 0 1px hsl(210 20% 85% / 0.4)`.
  - Manter blur/saturate e o highlight interno superior, mas reduzir o `::before` para não parecer "plástico".
- **Estado colapsado** — dentro de `[data-collapsible=icon] .sidebar-group-glass`:
  - Reduzir margem lateral (`margin: 4px 4px`) e padding (`padding: 6px 2px`).
  - Diminuir raio (`border-radius: 10px`).
  - Esconder o pseudo-elemento `::before` (fica estranho num container estreito).
  - Garantir que o cartão não gere overflow horizontal (`overflow: hidden`).
- **Dark mode**: adicionar bloco `.dark .sidebar-group-glass` com tint escuro translúcido (`hsl(215 30% 12% / 0.55)`) e borda `hsl(210 20% 40% / 0.35)` para manter o efeito perceptível no tema escuro.

### Fora do escopo
- Nenhuma mudança em `sidebar.tsx`, itens ativos, pill de contexto ou lógica de colapso.
- Sem tocar em outras superfícies (`.eva-surface`, cards do dashboard).

### Verificação
- Preview em desktop com sidebar aberta: grupos claramente delimitados sobre fundo branco.
- Toggle para modo colapsado: cartão compacto, sem cortar ícones nem hover.
- Alternar dark mode: efeito ainda visível, sem "vidro leitoso" opaco.
