

## 3D Tilt no Avatar Holográfico da EVA

### O que será feito
Adicionar uma rotação 3D (tilt) ao container do avatar que acompanha o mouse, criando sensação de profundidade. O canvas já faz o deslocamento das partículas; agora o container externo também vai inclinar levemente.

### Implementação

**Arquivo:** `src/components/landing/HolographicAvatar.tsx`

1. Adicionar um `ref` para o container div e um state para os valores de rotação (`rotateX`, `rotateY`).

2. No `handleMouseMove` existente, calcular os ângulos de tilt (max ±12°) baseados na posição normalizada do mouse e aplicar ao container via `transform: perspective(800px) rotateX(...) rotateY(...)`.

3. Aplicar `transition: transform 0.15s ease-out` no container para suavizar o movimento.

4. O container div principal recebe `style={{ perspective: "800px" }}` e o div interno do canvas recebe o `transform` com `rotateX/rotateY` dinâmicos.

### Detalhes técnicos
- `rotateY` = `(mouseX - 0.5) * 12` graus (mouse à direita → rotação positiva)
- `rotateX` = `(0.5 - mouseY) * 12` graus (mouse acima → rotação positiva, invertido para parecer natural)
- Usar `useState` para `tiltStyle` e atualizar no mesmo `handleMouseMove` já existente
- Adicionar `transformStyle: "preserve-3d"` para garantir o efeito 3D

