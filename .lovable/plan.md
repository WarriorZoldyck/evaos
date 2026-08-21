# Conferência do extrato PJ Santander (Sabrina) — julho/2026

## O que o extrato diz

Conta Santander Ag. 3656 / CC 130099529 (contexto Empresa "Sabrina Rodrigues Domingues"), período 01/07 a 31/07/2026:

- Saldo de abertura em 01/07: R$ 2.519,47
- Movimento do mês: +R$ 12.957,97 de entradas e −R$ 12.592,64 de saídas → líquido **+R$ 365,33**
- Saldo após o último lançamento (29/07): **R$ 2.884,80**
- Posição em 17/08 no extrato: R$ 350,00 em conta corrente + R$ 945,85 em ContaMax = **R$ 1.295,85**

## O que o sistema tem hoje (verificado no banco)

Para a mesma conta (`Santander`, saldo inicial 0):

- Antes de 01/07: R$ 2.519,47 — **igual ao extrato**
- Julho: +R$ 12.957,97 / −R$ 12.592,64 → **+R$ 365,33 — igual ao extrato**
- Saldo em 31/07: R$ 2.884,80 — **igual ao extrato**

Ou seja, **julho já bate centavo a centavo**. Três diferenças são só de forma, não de valor:

1. O Pix de −R$ 3.000,00 de 09/07 (João Vitor) está no sistema como as 29 compras do cartão "Itaú João" quitadas nesse dia — soma exatamente R$ 3.000,00.
2. O crédito de R$ 1.150,00 de 20/07 está dividido em dois lançamentos (R$ 250,00 + R$ 900,00).
3. O crédito de R$ 1.200,00 aparece em 31/07 no sistema e em 27/07 no extrato (mesmo mês, sem efeito no fechamento).

## Onde está a diferença de verdade

O saldo atual do sistema para a conta é **R$ 945,76**, contra **R$ 1.295,85** do extrato em 17/08 — diferença de **R$ 350,09**, toda gerada em agosto, que este PDF não cobre. Também há **67 lançamentos com status Pendente** nessa conta, que não entram no saldo.

## Plano

1. **Fechar julho como conferido** — nada a corrigir; opcionalmente marcar os lançamentos de julho como conciliados e alinhar as três diferenças de forma acima (unificar os R$ 250 + R$ 900 e mover a data do crédito de R$ 1.200 para 27/07) apenas para o extrato do sistema ficar visualmente idêntico ao do banco.
2. **Fechar agosto** — com o extrato de 01/08 a 17/08 eu comparo linha a linha e localizo exatamente os R$ 350,09 (provavelmente uma entrada/saída de agosto ainda não lançada ou marcada como Pendente).
3. **Revisar os pendentes** — listar os 67 lançamentos Pendentes dessa conta e converter em Pago os que já ocorreram, que é a causa mais comum de saldo do app abaixo do banco.
4. **Verificação final** — recalcular o saldo da conta e confirmar R$ 1.295,85 na posição de 17/08.

## Detalhes técnicos

- Conta: `bank_accounts.id = 1613aa1d-1dc6-4c23-a567-fa856c52be3e`, `initial_balance = 0` (o saldo de abertura de julho vem do histórico de lançamentos, não de um saldo inicial — por isso bate).
- Nenhuma alteração de código é necessária; os itens 1 a 3 são ajuste de dados (data/agrupamento/status) via correção pontual.
- Para o passo 2 preciso do extrato de agosto (01/08 a 17/08) da mesma conta.
