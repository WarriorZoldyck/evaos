# Saldo Santander em 30/07 — conferir os R$ 2.580 informados pela cliente

## O que já está confirmado (consultas no banco, agora)

Conta Santander (`1613aa1d…`), saldo inicial R$ 0,00:

| Item | Valor |
|---|---|
| Soma de todos os lançamentos **Pagos** até 30/07/2026 (99 itens) | **R$ 1.684,80** |
| Lançamentos pendentes até 30/07 | R$ 0,00 (nenhum) |
| Diferença para os R$ 2.580 esperados | **R$ 895,20 a menos** |

Outros fatos confirmados:
- Existem **51 lançamentos de cartão** debitados no Santander, somando **−R$ 6.203,22** (inclui os 29 que movemos na correção anterior, −R$ 3.000).
- Existe **1 transferência interna de +R$ 3.379,99** entrando no Santander e contando como receita no saldo.
- Em 31/07 entra +R$ 1.200 (Café Boujour), o que leva o saldo para R$ 2.884,80 em 31/07.

Ou seja: **ainda não batemos** com os R$ 2.580 em 30/07. Não vou afirmar a causa antes de checar os itens abaixo — a diferença de R$ 895,20 não tem explicação confirmada ainda.

## Investigação proposta (sem alterar dados)

1. **Listar os 51 lançamentos de cartão no Santander** com data de pagamento e cartão de origem, e separar quais faturas realmente saíram da conta até 30/07. Hipótese a testar: alguma fatura de cartão está debitada em data errada (antecipada), reduzindo o saldo de julho.
2. **Auditar a transferência interna de R$ 3.379,99**: confirmar se existe a perna oposta (saída na conta de origem) e se ela realmente ocorreu antes de 30/07. Uma transferência sem par infla ou deprime o saldo.
3. **Comparar com o extrato real do Santander de julho**: pedir o extrato (ou usar o que já foi importado) e casar linha a linha até 30/07. Isso identifica exatamente quais lançamentos faltam ou sobram para chegar aos R$ 2.580,00.
4. **Checar duplicidade/omissão na última importação**: buscar lançamentos com o mesmo valor e data (possíveis duplicatas) e lançamentos do extrato que não foram criados (ignorados na conciliação).

## Segundo ponto levantado pela cliente: divergência de centavos na conciliação

Ela relatou "saída real era 2000 e aparecia na conciliação 0,02". Passos:

1. Buscar lançamentos com valores de centavos (0,01 / 0,02) criados nas importações dela e ver se vieram de linhas de rendimento (há um "Rendimento Liquido De Contamax" de R$ 0,01 e outro de R$ 0,02 na conta) — pode ser apenas a linha certa do banco, não um bug.
2. Se for bug de parsing, reproduzir com o arquivo de extrato dela em `parse-bank-statement` e corrigir a extração de valor.
3. Pedir a ela o arquivo/print da linha exata que ficou com 0,02 para fechar o diagnóstico.

## Resultado esperado

- Uma explicação numérica fechada para a diferença de R$ 895,20 em 30/07.
- Correção de dados (se for erro de vínculo/data) ou explicação clara (se o saldo do sistema estiver certo e a memória dela estiver aproximada).
- Diagnóstico separado para a divergência de centavos na conciliação.

## Observação

Nada será alterado no banco nesta etapa — é só leitura e conferência. Qualquer correção de dados volta para você aprovar antes.
