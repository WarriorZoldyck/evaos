# Corrigir pares trocados na conciliação da fatura (simoespaula)

## O que está acontecendo

Na tela de conciliação, a coluna "Extrato" e a coluna "EVA" estão exibindo linhas que não têm relação entre si (DROGASIL R$ 19,80 aparece pareado com APPLECOMBILL R$ 51,90, dentro da seção "valor idêntico"). Não é falha de busca no banco — os candidatos foram encontrados; o que está errado é a **numeração das linhas**.

## Causa confirmada

Na mudança recente que passou a buscar candidatos em toda a família de cartões, as linhas do extrato passaram a ser processadas **em grupos por cartão**. Cada grupo é enviado ao motor de conciliação com uma numeração própria (0, 1, 2… dentro do grupo), e o resultado volta com essa numeração local.

- A decisão de cada linha (vincular/criar) é remapeada corretamente para o índice global da linha.
- Mas o **resultado bruto do match**, que é o que a tela usa para desenhar o par e para classificar a linha como "valor idêntico", continua guardado com o índice **local** do grupo.

Resultado: a tela lê o match da posição errada — mostra o candidato de outra linha e classifica a linha na seção errada. Antes da mudança havia um único grupo com todas as linhas, então local e global coincidiam e nada aparecia errado. É uma regressão dessa alteração.

Consequência prática visível no print: pares errados na seção verde, contagem de cobertura inflada (48/129) e divergência de R$ 23.135,20.

## Correção

1. O motor de conciliação (`useImportMatching.findMatches`) passa a receber, junto com as linhas, os **índices globais** correspondentes, e devolve/armazena o resultado sempre com esse índice global — nunca com a posição dentro do lote enviado.
2. O modal de importação (`ImportStatementModal.tsx`) deixa de fazer o remapeamento manual `res[localIdx] → rowIdx`; passa os índices globais na chamada e usa o retorno direto.
3. Com isso, tela (`ReconcileStep.tsx`), ações, alvos, tiers e contagem de cobertura passam a ler o mesmo índice — sem mais pares cruzados.
4. Teste de regressão em `src/lib/import/matching.test.ts` (ou arquivo novo de hook) cobrindo o caso multi-grupo: duas famílias de cartão em um mesmo extrato devem preservar o pareamento linha↔candidato.

## Depois de corrigir

Reabrir o mesmo extrato da fatura para a usuária e conferir: pares coerentes na seção "Igual — pode conciliar", cobertura real e divergência recalculada. Se ainda restar divergência depois disso, ela será de linhas genuinamente sem correspondência — aí sim caso de conciliação manual/agrupada, não de bug.

## Detalhes técnicos

- `findMatches(lines, ...)` ganha `options.rowIndices?: number[]`; o loop de scoring usa `rowIndices?.[i] ?? i` como chave em `result`.
- Manter `merge: true` para os grupos seguintes — com chaves globais o merge deixa de sobrescrever grupos anteriores (hoje as chaves 0..n de cada grupo colidem entre si).
- Nenhuma mudança em `matching.ts` (scoring) — a lógica de família e desempate por cartão permanece.
