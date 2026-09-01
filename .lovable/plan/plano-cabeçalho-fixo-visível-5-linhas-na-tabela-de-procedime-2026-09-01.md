# Plano: Cabeçalho fixo visível + 5 linhas na tabela de Procedimentos

## Diagnóstico (verificado)
- O `<thead>` já está `sticky top-0 z-10 bg-card` dentro de um contêiner de rolagem único em `ProcedureTableV2.tsx` (linha 123-125). A implementação do sticky está correta.
- Medição real (Playwright, mesmas classes do Tailwind): **cabeçalho = 48px**, **linha = 61px**.
- Com 8 procedimentos: 48 + 8×61 = 536px. O `max-h-[700px]` atual comporta a tabela inteira → **não rola verticalmente** → o sticky nunca dispara → por isso "parece igual".
- A barra horizontal inferior já está sempre visível (`overflow-x-scroll`). OK.

## Mudança
Em `src/components/precificacao-v2/ProcedureTableV2.tsx`, linha 123:

- Trocar `max-h-[700px]` por `max-h-[360px]`.
- Cálculo: 48 (cabeçalho) + 5×61 (linhas) = 353px → 360px mostra ~5 linhas inteiras + um leve vislumbre da 6ª, indicando que há scroll.
- Com 8 procedimentos (536px) > 360px, os 3 excedentes rolam verticalmente → o cabeçalho fixo (`sticky`) passa a ser visivelmente perceptível ao rolar.
- O `overflow-x-scroll` (barra horizontal sempre visível) e `overflow-y-auto` permanecem.

## Resultado esperado
- Cabeçalho (Procedimento | Qtd | Tempo | Lucr.% | Preço | ...) fica fixo no topo ao rolar a lista verticalmente.
- ~5 procedimentos visíveis de cada vez; o resto rola.
- Barra de rolagem horizontal inferior sempre presente.

## Observação
Se o número de procedimentos mudar muito, o `max-h-[360px]` continua válido: ele fixa a janela em ~5 linhas independente da quantidade total, sempre forçando scroll quando há mais de 5.
