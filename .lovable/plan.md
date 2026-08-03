# Explicar a divergência de R$ 21,70 na conciliação

## Situação

Os pares agora estão coerentes (nome e valor iguais dos dois lados) — a correção de numeração resolveu o cruzamento. Sobrou uma diferença de **R$ 21,70** entre o total informado pelo banco e a soma das linhas com decisão.

O que já está confirmado nos dados da conta: na fatura com vencimento 15/03/2026 existem hoje **49 lançamentos**, R$ 3.471,16 no total (38 no VISA SANTANDER e 11 no VISA GEOVANNA). Isso é consistente com o que a tela mostra em "conciliar".

O que **não** dá para afirmar sem olhar as linhas do extrato carregado na sessão: qual linha específica gera os R$ 21,70. As hipóteses possíveis (todas ainda não verificadas) são estorno/crédito somado com sinal invertido, linha ignorada que entrava no total do banco, arredondamento de parcela, ou uma linha do extrato lida com centavos errados.

Adivinhar aqui não ajuda — e essa mesma pergunta vai voltar na próxima fatura. A resposta certa é a tela saber explicar sozinha.

## O que será feito

**1. Detalhamento da divergência na própria tela**

O bloco "Divergência -R$ X" deixa de ser só um aviso e passa a abrir um detalhamento com:

- Total informado pelo banco.
- Soma das linhas que vão ser conciliadas.
- Soma das linhas que vão ser criadas.
- Soma das linhas ignoradas (a causa mais comum de diferença).
- Soma das linhas sem decisão, se houver.
- A conta fechando: banco − (conciliar + criar) = divergência.

Abaixo, a lista das linhas que compõem cada bucket, com data, descrição e valor, para o usuário bater a olho qual delas está sobrando ou faltando.

**2. Destacar créditos e estornos**

Linhas de valor negativo (estorno, pagamento de fatura anterior, crédito) ganham marcação visível e entram no somatório com o sinal correto. Se o sinal for a causa, isso fica evidente na hora.

**3. Validar com o caso real**

Abrir a fatura de vencimento 15/03/2026 da conta dela e usar o detalhamento para nomear exatamente de onde vêm os R$ 21,70 — e então dizer se é dado do extrato, decisão do usuário ou bug.

## Detalhes técnicos

- `ReconcileStep.tsx` / rodapé do `ImportStatementModal.tsx`: transformar o badge de divergência em botão que abre um `Dialog` com os totais por bucket derivados de `rows` + `matchActions`.
- Cálculo puro extraído para `src/lib/import/reconcileTotals.ts` (`buildDivergenceBreakdown`), com teste cobrindo linha ignorada, linha negativa e linha sem decisão.
- Comparações em centavos (`Math.round(v * 100)`) para não acumular erro de ponto flutuante no somatório.
- Sem migração de banco.
