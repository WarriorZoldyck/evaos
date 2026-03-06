

# Landing Page: Efeitos Luminosos, Avatar Holográfico Interativo e Roteamento

## Resumo

Três mudanças principais:
1. **Avatar holográfico interativo** no hero — partículas luminosas que formam uma silhueta feminina e reagem ao mouse (estilo Cortana/Halo), substituindo a imagem estática no círculo
2. **Efeitos luminosos intensificados** em toda a landing page — glows mais fortes, linhas de luz animadas, seções com bordas luminosas
3. **Nav com logo maior** e fundo que esconde o background da logo
4. **Roteamento**: `/` mostra landing page para visitantes, dashboard para logados

---

## 1. Avatar Holográfico Interativo

Criar um componente `HolographicAvatar.tsx` usando **HTML Canvas** com:
- ~800 partículas posicionadas formando uma silhueta feminina (busto/cabeça)
- Cada partícula é um ponto ciano/azul com glow
- **Mouse interaction**: ao mover o mouse sobre o canvas, as partículas se dispersam suavemente e retornam à posição original (spring physics)
- Efeito de "respiração" contínuo — partículas oscilam levemente mesmo sem interação
- Linhas de conexão entre partículas próximas (efeito "mesh/rede neural")
- Glow radial animado por trás

Substituir o bloco do avatar circular no `LandingHero.tsx` por este componente.

## 2. Efeitos Luminosos Intensificados

**LandingPage.tsx**: Adicionar elementos de fundo globais — linhas de luz horizontais animadas, orbs de glow flutuantes.

**LandingHero.tsx**: Glow mais forte atrás do avatar, raios de luz sutis.

**LandingFeatures.tsx**: Cards com glow no hover mais pronunciado, ícones com pulsação de luz.

**Seções gerais**: Divisores de seção com gradientes luminosos mais intensos, partículas de fundo sutis.

## 3. Nav — Logo Maior

**LandingNav.tsx**:
- Logo `h-10 w-10` (era `h-8 w-8`)
- Texto "EVA OS" um pouco maior (`text-xl`)
- Fundo do nav sólido o suficiente para esconder o fundo da logo (background matching)

## 4. Roteamento — Landing como página principal

**App.tsx**:
- Mover a rota `/` para renderizar `LandingPage` fora do `AppLayout`
- O `AppLayout` continua protegendo as rotas internas com auth check
- Mudar `AppLayout`: ao invés de redirecionar não-logados para `/auth`, redirecionar para `/` (landing)
- Dashboard fica em `/dashboard`
- Remover rota `/landing` duplicada

**AppLayout.tsx**: Alterar redirect de não-logados de `/auth` para `/`

| Arquivo | Mudança |
|---------|---------|
| `src/components/landing/HolographicAvatar.tsx` | **Novo** — Canvas com partículas interativas |
| `src/components/landing/LandingHero.tsx` | Substituir avatar estático pelo componente holográfico, intensificar glows |
| `src/components/landing/LandingNav.tsx` | Logo maior, fundo ajustado |
| `src/components/landing/LandingFeatures.tsx` | Glows mais fortes nos cards |
| `src/pages/LandingPage.tsx` | Adicionar efeitos de fundo globais (orbs, linhas de luz) |
| `src/App.tsx` | Roteamento: `/` = landing, `/dashboard` = dashboard |
| `src/components/layout/AppLayout.tsx` | Redirect não-logados para `/` |
| `src/components/layout/AppSidebar.tsx` | Atualizar link home para `/dashboard` |

