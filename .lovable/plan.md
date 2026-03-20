

## Ajuste do Glow + Profundidade de Corpo da EVA

### Problemas identificados
1. **Glow excessivo**: Quando o mouse se aproxima do avatar, o glow cria uma esfera ciano enorme que ofusca completamente as partículas do rosto. Os valores atuais escalam até `opacity 0.43` (inner) e `0.25` (outer ring), com `inset-[-18%]` no anel externo — muito agressivo.
2. **Falta corpo/torso**: O avatar mostra apenas o rosto. As referências da Cortana mostram ombros e parte superior do corpo, dando mais presença e profundidade holográfica.

### Mudanças

**Arquivo:** `src/components/landing/HolographicAvatar.tsx`

1. **Reduzir intensidade do glow**:
   - Inner glow: reduzir de `0.08 + proximity * 0.35` para `0.04 + proximity * 0.12` (max ~0.16 vs ~0.43)
   - Outer ring: reduzir de `proximity * 0.25` para `proximity * 0.08`
   - Reduzir `glowScale` de `1 + proximity * 0.15` para `1 + proximity * 0.06`
   - Diminuir o `inset` do outer ring de `-18%` para `-12%`

2. **Expandir avatar para incluir corpo**:
   - Trocar o `aspect-square` do container por uma proporção mais vertical (ex: `aspect-[3/4]`) para dar espaço ao torso
   - Na função `sampleImageToParticles`, ajustar o crop para usar a imagem completa (ou mais vertical) em vez de forçar um quadrado — permitindo que ombros/corpo apareçam
   - A imagem source (`eva-avatar.png`) precisa ter corpo. Se a imagem atual é só rosto, será necessário atualizar a imagem. Vou verificar a imagem atual e, se for só rosto, usar uma das referências como nova imagem do avatar.

**Arquivo:** `src/assets/eva-avatar.png` — Substituir pela imagem de referência (image-43.png, que tem corpo/ombros visíveis) para que as partículas mapeiem rosto + torso.

### Seção técnica
- O `sampleImageToParticles` atualmente força crop quadrado (`aspect 1:1`). Será alterado para usar a proporção natural da imagem (ou `3:4`) para capturar o corpo
- O container passa de `aspect-square` para `aspect-[3/4]`
- Os cálculos de `offsetX/offsetY` serão ajustados para centralizar a imagem no canvas sem cortar o torso
- As partículas do corpo terão naturalmente menor brilho/opacidade que o rosto, criando o efeito de fade-out gradual do holograma para baixo — similar à Cortana

