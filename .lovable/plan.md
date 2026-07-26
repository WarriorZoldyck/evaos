# EVA Design System v1 — Fundação Visual

Objetivo: consolidar a linguagem visual da sidebar em um sistema base reutilizável, sem alterar componentes, rotas, hooks ou lógica. Depois desta rodada, todas as próximas telas passam a consumir os mesmos tokens/classes.

## Escopo desta rodada
Apenas dois arquivos:
- `src/index.css` — novos tokens + camada `@layer components` com utilitários visuais
- `tailwind.config.ts` — mapear novos tokens (radii, shadows, cores semânticas de superfície) para uso via classes

Nada mais é tocado. Componentes shadcn, JSX, hooks, comportamentos e dark mode permanecem exatamente como estão. Dark mode ganha apenas os valores equivalentes dos tokens novos (mesmos nomes, valores adaptados), sem alterar o visual atual.

## 1. Escala de superfícies (4 níveis)

Tokens novos em `:root` (e equivalentes em `.dark`):

```
--surface-0   → fundo da app (já é --background, apenas alinhar)
--surface-1   → cards, painéis, containers
--surface-2   → tabelas, blocos internos dentro de cards
--surface-elevated → modais, popovers, dropdowns

--border-soft    → bordas neutras (1px translúcida)
--border-strong  → bordas de foco/ativo
--border-glass   → bordas com highlight interno (superfícies premium)

--shadow-soft    → cards padrão
--shadow-medium  → hover / elementos flutuantes
--shadow-strong  → modais / popovers elevados
--shadow-inset-hi → highlight interno superior (acabamento premium)

--eva-primary        → 199 100% 36% (azul EVA já usado na sidebar ativa)
--eva-primary-strong → 201 100% 28%
--eva-primary-soft   → 198 100% 96%
--eva-primary-ring   → 195 100% 50% / 0.35

--radius-sm  → 8px
--radius-md  → 10px
--radius-lg  → 13px  (alinhado ao sidebar-item)
--radius-xl  → 16px
--radius-2xl → 20px
```

Os tokens existentes (`--background`, `--card`, `--primary`, `--radius`, `--glass-*`, `--neu-*`, `--sidebar-*`) permanecem intactos. Os novos convivem com eles.

## 2. Utilitários base em `@layer components`

Classes reutilizáveis, no mesmo espírito de `.sidebar-glass` / `.sidebar-item`:

- `.eva-surface` — card padrão (surface-1 + border-soft + shadow-soft + radius-lg + highlight interno leve)
- `.eva-surface-elevated` — para modais/popovers/dropdowns (shadow-strong + border-glass)
- `.eva-surface-sunken` — para tabelas/áreas internas (surface-2, sem sombra)
- `.eva-interactive` — base para botões/pills/chips: transição curta, hover eleva 1px, active volta, focus ring azul EVA
- `.eva-interactive-primary` — variação com gradiente azul EVA + inset highlight (equivalente ao item ativo da sidebar, para botão principal)
- `.eva-input` — acabamento consistente para inputs/selects (border-soft, focus ring EVA, radius-md)
- `.eva-chip` — pill neutro (superfície com border translúcida)
- `.eva-badge-soft` — badge com sombra interna leve (já existe `.sidebar-badge-soft` como referência)
- `.eva-divider` — separador sutil translúcido
- `.eva-focus-ring` — utilitário aplicável em qualquer elemento focável

Todas as classes são aditivas: podem ser combinadas com o Tailwind atual sem substituir nada.

## 3. Ajustes em `tailwind.config.ts`

Somente `extend`, sem remover nada:
- `colors`: `surface.0/1/2/elevated`, `eva.primary/strong/soft`, `border.soft/strong`
- `borderRadius`: `xl`, `2xl` mapeando para os tokens novos (mantendo `lg/md/sm` existentes)
- `boxShadow`: `soft`, `medium`, `strong`, `inset-hi`
- `transitionTimingFunction`: `eva` (curva única para toda a UI)

Isso permite usar `bg-surface-1`, `shadow-soft`, `rounded-xl`, etc., nas próximas rodadas sem escrever CSS custom.

## 4. Dark mode
Mesmos nomes de tokens, valores calibrados para o dark atual (superfícies mais escuras, bordas mais claras translúcidas, sombras mais discretas). Nenhuma classe nova é aplicada agora, então nada muda visualmente no dark até a próxima rodada.

## 5. O que NÃO acontece nesta rodada
- Nenhum componente shadcn é editado (button, card, input, dialog, table, badge…)
- Nenhuma página é editada
- Nenhum JSX é tocado
- Nenhuma dependência nova
- Nenhum SVG, animação pesada, ou refactor de lógica
- Sidebar continua exatamente como está (já é a referência)

## 6. Entregável
Ao final desta rodada:
- Tokens globais consolidados e documentados no CSS
- Utilitários `.eva-*` disponíveis para uso
- Tailwind com aliases prontos
- Zero mudança visual imediata em telas existentes fora da sidebar (que já usa a linguagem)

## 7. Próximas rodadas (fora deste plano, apenas para contexto)
Cada uma será um plano separado, aplicando os tokens/classes:
1. Header + botões primários/secundários
2. Cards principais do Dashboard
3. Inputs, selects, dropdowns
4. Tabelas
5. Modais e popovers
6. Badges, empty states, charts

## Critério de aceite
- `src/index.css` compila sem quebrar nada
- Sidebar permanece idêntica visualmente
- Nenhuma outra tela muda visualmente
- Novas classes `.eva-*` e tokens estão disponíveis para as próximas rodadas
