# Aviso claro para lucratividade impossível

## Situação atual

Ao editar a coluna "Lucr. %" na tabela de Procedimentos, se a margem digitada tornar o cálculo impossível (margem + alíquota de imposto >= 100%), o campo apenas fica com a borda vermelha e o preço não é recalculado. O usuário não recebe nenhuma explicação do porquê nada aconteceu.

## O que muda

Quando a margem digitada for impossível, mostrar um aviso claro e acionável ao lado do campo:

- Um ícone de alerta ao lado do input, com tooltip/popover explicando em linguagem simples:
  "Margem impossível: com alíquota de X%, a lucratividade máxima é Y%." (Y = 100 − alíquota, com pequena folga)
- Um botão de ação rápida no aviso: **"Usar margem máxima (Y%)"**, que aplica a maior margem viável e recalcula o preço na hora.
- Se a alíquota for 0 e a margem digitada for >= 100%, a mensagem indica que a lucratividade precisa ser menor que 100%.
- Um toast (sonner) no mesmo momento com a mesma mensagem curta, para quem não passa o mouse sobre o ícone.
- O aviso desaparece assim que uma margem válida é aplicada ou o usuário sai do campo com valor válido.

Também tratar o caso relacionado de margem negativa muito extrema: continua permitido (é um cenário real de prejuízo), mas o valor fica destacado em vermelho como já é hoje na coluna, sem bloquear.

## Detalhes técnicos

- Arquivo: `src/components/precificacao-v2/ProcedureTableV2.tsx`.
- Substituir o estado `invalidMarginId: string | null` por `invalidMargin: { id: string; attempted: number; maxPct: number } | null`, para poder montar a mensagem e o botão "usar margem máxima".
- Calcular `maxPct = Math.max(0, 100 - taxRate - 0.1)` e usar esse valor tanto na mensagem quanto na ação rápida (aplica `desired_price` via `calcParts` + `onInlineUpdate`, mesma fórmula já usada).
- Renderizar o alerta com `Tooltip`/`Popover` do shadcn já existente e `AlertTriangle` do lucide, dentro da célula, sem alterar a largura das demais colunas.
- Toast via `sonner` (`toast.error`), disparado apenas na transição para estado inválido (não a cada tecla).
- Nenhuma mudança em `usePricingV2.ts` nem em outras páginas.
