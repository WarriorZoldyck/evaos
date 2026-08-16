# Landing page em tom claro (estilo Conta Azul)

Transformar a página inicial pública (`/`) do visual escuro futurista para um layout claro, arejado e informativo, mantendo a identidade ciano da EVA. A EVA (avatar holográfico) sai do hero e fica reservada para o EVA Kids.

## Direção visual

- Fundo branco `#ffffff` com faixas alternadas em `#eef7fb` para separar seções.
- Azul profundo `#0e7490` para títulos/CTA e ciano `#48CAE4` como destaque, brilhos e ícones.
- Texto em cinza-azulado escuro, cards com borda suave e sombra leve (sem glassmorphism pesado, sem neon).
- Tipografia mantida (Space Grotesk + Inter), com headlines maiores e mais respiro entre seções.

## Hero

- Coluna esquerda: badge, headline curta, subtítulo informativo, CTA "Começar grátis" + link "Ver como funciona", prova social (+500 profissionais).
- Coluna direita: mockup do dashboard real do EVA OS (notebook + celular, ao estilo da referência), gerado como imagem de produto clara.
- Remoção completa do `HolographicAvatar` e do asset da EVA do hero (arquivo do avatar permanece no projeto para uso futuro no EVA Kids).
- Sai o fundo escuro com orbs/scanlines; entra um degradê claro suave.

## Demais seções (todas convertidas para o tema claro)

- Recursos, Como funciona, Depoimentos, Preços, FAQ e Rodapé: mesma estrutura de conteúdo, repaginados em cards brancos sobre fundo claro.
- Faixa de números/benefícios em bloco azul sólido para contraste, como na referência.
- Rodapé claro com divisórias suaves e link/CTA final.

## Detalhes técnicos

- Arquivos afetados: `src/pages/LandingPage.tsx` (remove orbs/estilos escuros), `src/components/landing/LandingHero.tsx`, `LandingNav.tsx`, `LandingFeatures.tsx`, `LandingHowItWorks.tsx`, `LandingTestimonials.tsx`, `LandingPricing.tsx`, `LandingFAQ.tsx`, `LandingFooter.tsx`.
- `HolographicAvatar.tsx` deixa de ser usado na landing (componente removido do fluxo da página).
- Novos tokens claros da landing definidos em `src/index.css` (ex.: `--landing-bg`, `--landing-surface`, `--landing-accent`) e usados via classes, evitando cores hardcoded espalhadas.
- O dashboard/app interno e o tema escuro do sistema não são alterados — mudança restrita à landing pública.
- Mockup do hero gerado como imagem em `src/assets` e importado normalmente.
- Metadados de SEO em `index.html` permanecem; apenas ajusto o texto do hero se necessário para coerência.
