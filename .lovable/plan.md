# Verificar de verdade a conciliação da fatura (simoespaula)

## O que você apontou está correto

DROGASIL R$ 19,80 e APPLECOMBILL R$ 51,90 são lançamentos diferentes — nome diferente e valor diferente. Eles nunca deveriam ter aparecido pareados. Isso confirma o diagnóstico: o par exibido não vinha do motor de comparação, vinha da tela lendo o resultado da posição errada (numeração local do grupo de cartão em vez da numeração global da linha).

## Estado atual

A correção de numeração já foi aplicada e o teste de regressão criado passa: uma linha na posição global 7, enviada sozinha em um grupo, volta chaveada em 7 e não em 0.

O que ainda **não** foi feito é a prova com os dados reais da conta dela. Enquanto isso não acontecer, a afirmação "está certo" é baseada só em teste sintético — e é justo desconfiar.

## Como provar

1. Reabrir o extrato da fatura Santander (vencimento 15/03/2026) na conta simoespaula, no ambiente de preview.
2. Conferir, linha a linha, na seção "Igual — pode conciliar": descrição do extrato e descrição do lançamento EVA precisam ser da mesma compra, e o valor precisa ser idêntico nos dois lados.
3. Conferir os números de cabeçalho: cobertura e divergência recalculadas (antes: 48/129 e R$ 23.135,20 — números inflados pelo pareamento errado).
4. Registrar evidência em captura de tela do resultado.

## Endurecer contra a classe do erro

Além de olhar, adicionar uma trava que impede o sintoma de voltar sem alarde:

- Na montagem do par exibido, validar que o candidato tem o **mesmo valor** da linha do extrato quando ela é classificada como "valor idêntico". Se não tiver, a linha não entra na seção verde — cai em "revisar" em vez de sugerir uma conciliação errada.
- Cobrir isso com teste: par com valores diferentes nunca pode ser classificado como idêntico.

## Detalhes técnicos

- Verificação via Playwright contra `localhost:8080` com a sessão da conta, navegando até a tela de conciliação e capturando o painel de pares.
- Trava de coerência em `ReconcileStep.tsx`, no ponto onde a linha é classificada em tiers (`igual` / `aproximado` / `sem match`): comparar `Math.abs(line.amount) - candidate.amount` contra `AMOUNT_TOLERANCE` antes de marcar como idêntico.
- Teste em `src/lib/import/matching.test.ts` ou no arquivo do hook.
- Sem migração de banco.
