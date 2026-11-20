# Cartão combinado com outras formas no parcelado

## Problema
Quando a receita parcelada usa só cartão, a tela já pede a maquininha e mostra taxa, bruto, MDR, líquido e recebimento. Quando o cartão é combinado com outra forma (ex.: R$ 8.000 no cartão em 3x + boleto), esse bloco some: cada parcela de cartão mostra só "Cartão de..." com uma conta bancária para escolher, sem maquininha e sem taxa. Isso acontece porque a tela da maquininha só aparece quando há uma única modalidade selecionada.

## O que muda (só em receitas parceladas)
1. **Bloco "Cartão de Crédito" (e Débito) dentro das modalidades**: além de Valor e "Em quantas vezes?", ganha o campo **Maquininha** (Cielo, Rede...). Abaixo aparece o mesmo resumo da tela do cartão: taxa, valor bruto, desconto MDR, valor líquido e data de recebimento (D+X), calculado só sobre a parte do cartão.
2. **Parcelas do cartão na lista**: em vez de "Sem conta vinculada" / conta bancária, mostram a maquininha escolhida, o valor bruto e o líquido, com a data de recebimento da maquininha (sem campo de conta para mapear).
3. **Outras formas (boleto, PIX, dinheiro...)**: continuam como hoje, com a conta repetindo automaticamente nas parcelas da mesma modalidade.
4. **Juros mensal**: o campo de juros vale só para as partes que não são cartão; a parte do cartão usa a taxa da maquininha.
5. **Validação**: não deixa salvar se o cartão estiver selecionado sem maquininha ("Escolha a maquininha do cartão"); boleto continua exigindo conta, dinheiro carteira.
6. **Ao salvar**: a parte do cartão gera os recebíveis da maquininha (valor líquido, data D+X, ligados à maquininha), igual ao cartão sozinho; as demais partes geram as parcelas normais. Tudo fica na mesma série do lançamento.

Cartão sozinho e à vista continuam exatamente como estão.

## Detalhes técnicos
- `InstallmentPreviewTable.tsx`: no config da modalidade de cartão adicionar `terminalId`; renderizar seletor de maquininha + `MdrInfoCard` reaproveitado (mesma regra de cálculo de `terminalPreview`/`installmentPricing`). Linhas de parcela cujo método é cartão exibem a maquininha e valor líquido em vez do seletor de conta; propagar `terminalId` via `customPayments` (`account: "terminal:<id>"`).
- `TransactionFormModal.tsx`: passar `cardTerminals` para a tabela; no save, partes com `terminal:` usam a mesma lógica de taxa/settlement do fluxo com `selectedTerminal` (rate por nº de parcelas via `parseRatesInfo`, `settlement_days_credit`/`debit`), gravando `card_terminal_id`, `amount` líquido e `original_amount` bruto.
- Extrair o cálculo de taxa/recebimento da maquininha para um helper puro e cobrir com testes: 8.000 em 3x numa maquininha com taxa definida gera 3 recebíveis com líquido e datas corretos; cartão sem maquininha bloqueia o save.
