## Problema

No mobile (Safari/Chrome iOS), o `CreditCard3D` no Dashboard renderiza a frente e o verso sobrepostos: aparecem simultaneamente o chip/bandeira/nome (frente) e a barra "Utilizado / Disponível / Fecha / Vence" (verso), com os dígitos "embaralhados" no meio. É o bug clássico de `backface-visibility` em WebKit quando o filho não recebe o prefixo `-webkit-` nem o `transform: translateZ(0)` para forçar sua própria camada 3D.

Além disso, o card tem largura fixa `w-[340px]` e o carrossel usa `gap-6` + `px-2`. Em telas de ~360–380px isso corta a borda direita do card e agrava a sensação de "bugado".

## Correções

### 1) `src/components/contas/CreditCard3D.tsx` — corrigir 3D no Safari mobile
- Nas duas faces (`FRONT` e `BACK`), adicionar no `style`:
  - `WebkitBackfaceVisibility: "hidden"` (junto do `backfaceVisibility: "hidden"` já existente)
  - `WebkitTransform` espelhando o `transform` (identidade na frente, `rotateY(180deg)` no verso)
  - `transform: "translateZ(0)"` na frente para forçar camada própria
- No wrapper que rotaciona, adicionar `WebkitTransformStyle: "preserve-3d"` e `WebkitTransform` espelhando o `transform` dinâmico.
- Isso elimina a sobreposição de faces no iOS sem alterar a aparência no desktop.

### 2) `src/components/contas/CreditCard3D.tsx` — largura responsiva
- Trocar `w-[340px] h-[210px]` por algo que respeite o viewport:
  - Wrapper externo: `w-full max-w-[340px] mx-auto`
  - Card 3D interno: `w-full aspect-[340/210]` (mantém a proporção original)
- Ajustar paddings internos para escalarem: manter `p-6` no ≥sm e usar `p-5` no mobile onde necessário (apenas se houver corte visível), sem mexer na tipografia.

### 3) `src/components/dashboard/DashboardCreditCardsRow.tsx` — carrossel no mobile
- No container do scroll horizontal, reduzir `gap-6` para `gap-4` no mobile (`gap-4 sm:gap-6`) e garantir `min-w-0` no item.
- Envolver cada `CreditCard3D` num wrapper `w-[300px] sm:w-[340px] shrink-0 snap-start` para que o card não estoure a viewport nem seja cortado pela borda.
- Skeleton: aplicar a mesma largura responsiva (`w-[300px] sm:w-[340px]`) para consistência.

## Fora de escopo
- Não mexer no layout do verso (barra de uso, grid Disponível/Fecha/Vence), no header do card ("Cartões de Crédito / Ver todos") nem na navegação de ciclo.
- Não alterar o `CreditCard3D` usado em outras telas além do necessário — as mudanças são retrocompatíveis (proporção e prefixos WebKit).

## Verificação
- Abrir `/dashboard` no viewport mobile (375×812) e conferir:
  - Só a frente aparece quando `isFlipped=false`; só o verso quando `true`.
  - O card cabe inteiro na tela, sem cortar a borda direita.
  - A animação de flip continua suave no desktop.
