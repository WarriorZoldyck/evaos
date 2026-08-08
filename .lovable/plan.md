# Precificação — salas inteiras, lucratividade editável e tabela mais alta

## 1. Qtd. de salas: apenas números inteiros

Sala é um local físico — não existe meia sala. O campo passa a aceitar somente inteiros (passo de 1, mínimo 1), e o texto "Aceita decimais (ex: 0,546)" é removido. Valores decimais já salvos são arredondados ao salvar.

## 2. Lucratividade editável, como 3ª coluna

A coluna "Lucr. %" sai do fim da tabela e passa a ficar entre **Tempo (h)** e **Preço**, virando um campo editável como os demais.

Ao digitar uma lucratividade (ex.: 30%), o sistema calcula e grava o **preço** que produz aquela margem, e todas as colunas (Preço/un., CF, CV, NF, Líquido, Lucr./h) se atualizam na hora. Ao editar o preço, a lucratividade volta a ser calculada a partir dele — os dois campos ficam sincronizados nos dois sentidos.

Se a lucratividade digitada somada à alíquota chegar a 100% ou mais, o cenário é impossível: o campo fica marcado em vermelho e o preço não é alterado.

O **simulador abaixo da tabela é removido** (junto com o card "Selecione um procedimento..."), já que a edição inline cobre o mesmo uso.

## 3. Altura da tabela de procedimentos

A área rolável passa de 400px para uma altura equivalente a **4 linhas visíveis** (cabeçalho + 4 linhas) antes de começar o scroll, para não exigir rolagem da página inteira. O scroll horizontal continua funcionando dentro do card.

## Detalhes técnicos

- `src/components/precificacao-v2/ConfigCard.tsx`: input de salas com `step=1`, `min=1`, arredondamento no submit; remover a legenda de decimais.
- `src/components/precificacao-v2/ProcedureTableV2.tsx`: mover o `TableHead`/`TableCell` de Lucr. % para depois de Tempo; usar `LiveNumberInput` com sufixo `%`; no commit, calcular `preço = (CF + CV) / (1 − margem% − aliquota%)` e chamar `onInlineUpdate(id, { desired_price })`. Recebe `calcParts` e `taxRate` como props. Wrapper com `max-h` de ~4 linhas e `overflow-auto`.
- `src/pages/Precificacao.tsx` e `src/pages/PrecificacaoV2.tsx`: remover o bloco `ProcedureSimulator` (e o card de placeholder), passar as novas props para a tabela, ajustar a altura do container.
- Excluir `src/components/precificacao-v2/ProcedureSimulator.tsx`.
- `usePricingV2` já expõe `calcParts` e `suggestPrice`; nenhuma mudança de banco.
