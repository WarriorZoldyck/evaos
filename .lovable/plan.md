

## Zoom na EVA + Rosto Seguindo o Mouse

### O que muda

1. **Zoom na imagem**: Aumentar o `max-w` do container de `480px` para `680px` e aplicar `scale(1.15)` na imagem para ela preencher todo o lado direito do banner. Usar `overflow-hidden` no container do hero para cortar bordas se necessário.

2. **Rosto segue o mouse**: Trocar o efeito atual de tilt 3D (que rotaciona a imagem inteira como um cartão) por um efeito de **parallax sutil** — a imagem se desloca levemente na direção do mouse (translateX/Y de ±15px), como se a EVA estivesse "olhando" para onde o cursor está. Manter uma rotação mínima (±3deg) para dar naturalidade.

3. **Ajuste no hero**: Permitir overflow visível no container do avatar para a imagem maior não ser cortada, e reposicionar os cards flutuantes para acompanhar o tamanho maior.

### Arquivos alterados

- `src/components/landing/HolographicAvatar.tsx` — Aumentar max-w para 680px, trocar rotateX/Y por translateX/Y + rotação sutil, escalar imagem
- `src/components/landing/LandingHero.tsx` — Ajustar container do avatar se necessário para acomodar tamanho maior

