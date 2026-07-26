# Sidebar Glass Neumorphism — Iteração 2 (intensificar com moderação)

## Objetivo
Manter estrutura, lógica e comportamento intactos. Reforçar a camada visual da sidebar para que o Glass Neumorphism fique perceptível de imediato, sem virar concept futurista. Foco principal: destacar o item ativo (hoje quase invisível) e dar aparência premium ao dropdown "Pessoal".

## Escopo
Somente dois arquivos, já usados na iteração 1:
- `src/index.css` — ajustar tokens e as classes `.sidebar-*` existentes.
- `src/components/layout/AppSidebar.tsx` — nenhuma alteração de JSX prevista.

## O que NÃO muda
- JSX, hooks, rotas, colapso, dropdown de contexto, badges, NavLink customizado, `activeClassName`, logout.
- Nenhum componente shadcn substituído.
- Nenhuma classe Tailwind funcional removida.
- Dark mode permanece sem overrides novos.
- Sem novos pacotes, sem SVG, sem framer/gsap.

## Ajustes visuais (todos dentro das classes já criadas)

1. **`.sidebar-glass` — vidro perceptível sem embaçar**
   - `background: hsl(var(--glass-surface) / 0.74);` (era 0.78)
   - `backdrop-filter: blur(8px) saturate(1.12);` (era 5px/1.05)
   - Sombra externa mais firme + highlight interno superior:
     - `box-shadow: 10px 0 32px -22px hsl(var(--neu-dark)), inset 1px 0 0 hsl(var(--neu-light)), inset 0 1px 0 hsl(0 0% 100% / 0.85);`

2. **`.sidebar-item` — hover mais evidente e composição otimizada**
   - Acrescentar `will-change: transform;` na classe base.
   - Hover:
     - `background: hsl(0 0% 100% / 0.55);`
     - `box-shadow: -3px -3px 8px hsl(var(--neu-light)), 3px 3px 10px hsl(var(--neu-dark) / 0.55);`
   - Mantém `transform: translateY(-1px)` e transição de 180ms.

3. **`.sidebar-item-active` — botão macOS-like (mudança de maior impacto)**
   - Tokens no `:root`:
     - `--sidebar-active-from: 198 100% 92%;` (era 96%)
     - `--sidebar-active-to: 199 90% 84%;` (era 92%)
     - `--sidebar-active-fg: 201 100% 28%;` (era 36%)
   - Sombra composta:
     - `box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.9), inset 0 -1px 0 hsl(199 60% 70% / 0.35), 0 2px 6px -2px hsl(199 80% 40% / 0.28), 0 0 0 1px hsl(199 70% 65% / 0.35);`
   - Ícone SVG do item ativo em `hsl(199 100% 42%)`.

4. **`.sidebar-context-pill` (dropdown "Pessoal") — aspecto premium**
   - `background: hsl(0 0% 100% / 0.72);`
   - `backdrop-filter: blur(10px) saturate(1.1);`
   - `box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.9), -2px -2px 5px hsl(var(--neu-light)), 2px 3px 8px hsl(var(--neu-dark) / 0.4);`
   - `border: 1px solid hsl(0 0% 100% / 0.75);`

5. **`.sidebar-badge-soft`** — sem alteração.

## Parâmetros consolidados
| Propriedade   | Iteração 1 | Iteração 2   |
| ------------- | ---------- | ------------ |
| Opacidade     | 0.78       | **0.74**     |
| Blur          | 5px        | **8px**      |
| Saturate      | 1.05       | **1.12**     |
| Hover shadow  | leve       | reforçada    |
| Active shadow | tímido     | macOS-like   |
| Context pill  | discreto   | premium      |

## Critério visual (guarda-corpo de intensidade)
Após aplicar, comparar mentalmente com a iteração anterior. O objetivo é que a diferença seja perceptível imediatamente, sem transmitir sensação futurista.

Se ainda parecer imperceptível, **ajustar apenas** a intensidade das sombras e do destaque do item ativo — **nunca** aumentar transparência (`< 0.72`) ou blur (`> 10px`).

---

## Princípios de Design

A sidebar deve transmitir:
- Elegância
- Clareza
- Profundidade
- Leveza
- Precisão

Não deve chamar mais atenção que o conteúdo principal. O objetivo é aumentar a percepção de qualidade do produto, e não criar um elemento visual protagonista.

Sempre que houver dúvida entre um efeito mais forte ou mais discreto, priorizar a opção mais discreta.

## Referência de qualidade

A qualidade visual esperada é semelhante a aplicações como:
- Apple System Settings
- Arc Browser
- Linear
- Raycast
- Notion Calendar

Não utilizar como referência interfaces cyberpunk, neon, holográficas ou futuristas. O resultado deve parecer um software financeiro premium.

## Regra de ouro

O usuário não deve perceber "efeitos". Ele deve perceber apenas que a interface ficou mais refinada.

Os efeitos devem ser sentidos, não vistos. Se algum efeito chamar atenção por si só, ele está forte demais.

---

## Checklist de não regressão
- Colapso/expansão da sidebar continua funcionando.
- Item ativo detectado exatamente como antes (`NavLink` + `activeClassName`).
- Dropdown de contexto abre/fecha normalmente.
- Badges numéricos e "Em breve" seguem no `ml-auto`.
- "Sair" mantém hover destrutivo.
- Dark mode inalterado.
- Nenhum arquivo além de `src/index.css` alterado.

## Detalhes técnicos
- Todos os valores em HSL.
- Highlights internos via `inset` no `box-shadow` — sem pseudo-elementos.
- `will-change: transform` restrito a `.sidebar-item`.
- Blur máximo 10px: seguro em desktop.

## Nota para as próximas etapas (fora do escopo deste plano)
Após a aprovação desta sidebar, o próximo passo recomendado não é atacar Header/Cards um por um, e sim consolidar um **Design System EVA** com tokens compartilhados (superfícies, interações, destaques, elevação em 4 níveis). Isso será proposto em plano separado quando esta iteração estiver aprovada.
