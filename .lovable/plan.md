## Diagnóstico

O problema não está no extrato como fonte de verdade; está no cálculo exibido na etapa `Sistema × Extrato`.

Hoje a tela soma:

```text
Sistema = lançamentos casados + órfãos encontrados por janela de datas
```

Isso infla o valor porque a lista de órfãos/sugestões pode incluir compras que não compõem a fatura aberta atual, enquanto na tela de lançamentos o próprio sistema já mostra a fatura correta do cartão Azul: `-R$ 1.116,65` com `7 lançamentos`.

Além disso, o PDF enviado contém mais de um total possível (`3.608,27`, limite utilizado `4.267,26`, etc.). Para reconciliação, o sistema precisa tratar o extrato como absoluto para as linhas importadas, mas comparar contra a fatura já agrupada no sistema, não contra uma soma oportunista de candidatos por data.

## Plano de ajuste

1. **Usar o total real da fatura do sistema na conciliação**
   - Buscar os lançamentos já agrupados na fatura aberta do cartão selecionado, pelo mesmo critério usado em `/lancamentos` para exibir `VISA Azul • Fatura jun/2026`.
   - O total `Sistema` na etapa de importação deve bater com esse grupo: `-R$ 1.116,65`, e não com soma de candidatos/órfãos.

2. **Separar “candidatos para conciliar” de “total da fatura”**
   - Manter candidatos de matching apenas para sugerir vínculos linha a linha.
   - Não deixar candidatos sem vínculo, órfãos ou sugestões alterarem o valor principal da fatura do sistema.

3. **Restringir órfãos ao escopo da fatura aberta**
   - “Só no sistema” deve listar apenas lançamentos que pertencem ao mesmo cartão e à mesma fatura exibida no sistema.
   - Não incluir lançamentos sem cartão, de conta bancária, pagos, faturas anteriores ou fora do agrupamento real da fatura.

4. **Comparar totais com clareza**
   - Exibir:
     - `Sistema`: total da fatura aberta do cartão no EVA.
     - `Extrato`: total das linhas selecionadas/importadas do arquivo.
     - `Diferença`: extrato menos sistema.
   - A contagem do sistema deve vir do grupo real da fatura (`7 lançamentos` no caso da imagem), não da quantidade de linhas parseadas do PDF se ela divergir.

5. **Ajustar validações e testes**
   - Adicionar caso garantindo que órfãos não entram no total da fatura.
   - Adicionar caso para fatura de cartão onde o sistema já tem `7 lançamentos / 1.116,65` e o reconciliador não pode transformar isso em `9 lançamentos / 4 mil`.

## Resultado esperado

Ao importar/conferir esse extrato do Azul, a etapa de conciliação deve respeitar o que já está no sistema:

```text
VISA Azul • Fatura jun/2026
Sistema: R$ 1.116,65 / 7 lançamentos
```

Qualquer coisa fora disso deve aparecer apenas como linha para revisão, nunca como total real da fatura.