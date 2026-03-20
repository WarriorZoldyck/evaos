

## Novo Avatar EVA - Imagem 3D com Ambiente Holográfico

### O que muda
Abandonar a abordagem de textura numa esfera (que fica "imagem girando"). Em vez disso, a nova imagem da EVA fica como um **plano central fixo** (billboard) enquanto todo o ambiente 3D ao redor dela gira e reage ao mouse: esfera holográfica translúcida, anéis orbitais, partículas de dados, e linhas de código flutuantes.

### Conceito visual
- A EVA fica estática no centro como uma projeção holográfica (plano com transparência)
- Atrás dela, uma **esfera wireframe** translúcida gira lentamente (como na imagem de referência)
- Partículas de dados e pequenos elementos HUD orbitam ao redor
- Efeito de **scanlines e glitch** aplicado via CSS no plano da imagem (não no shader da esfera)
- Mouse move a câmera levemente (parallax), dando profundidade real sem distorcer a imagem
- Glow pulsante ciano/violeta emana do centro

### Implementação

**Arquivo:** `src/components/landing/HolographicAvatar.tsx` (reescrita completa)

1. **Copiar a imagem** `user-uploads://image-48.png` para `src/assets/eva-avatar.png`

2. **Plano central (Billboard)**: Um `<planeGeometry>` com a textura da EVA, usando `meshBasicMaterial` com `transparent: true` e `alphaTest`. Fica fixo olhando a câmera, sem rotação.

3. **Esfera wireframe holográfica**: Uma `sphereGeometry` com `wireframe: true`, material translúcido ciano, girando lentamente. Raio ligeiramente maior que o plano para envolver a EVA.

4. **Anéis orbitais**: Manter os `HoloRing` existentes girando ao redor.

5. **Partículas de dados**: Manter `DataParticles` orbitando ao redor.

6. **Parallax com mouse**: Em vez de rotacionar a imagem, a **câmera** se desloca levemente com o mouse (parallax), criando profundidade real entre camadas (imagem no centro, esfera atrás, partículas ao redor).

7. **Efeitos CSS overlay**: Scanlines e flicker aplicados como um `div` overlay sobre o Canvas com `mix-blend-mode` e animação CSS.

8. **3D Tilt no container**: Manter o tilt existente do container.

### Detalhes técnicos
- Plano: `planeGeometry` com aspect ratio da imagem (~1:1), tamanho ~3 units
- Esfera wireframe: raio 2.0, segments 32, `opacity: 0.15`, cor ciano
- Câmera parallax: deslocamento máximo ±0.3 units no X/Y seguindo o mouse com lerp
- Scanlines CSS: `repeating-linear-gradient` com linhas de 1px a cada 3px, opacity 0.05
- Remover o fundo cinza da imagem via `alphaTest: 0.1` no material

