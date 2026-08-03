# Conciliação sem match — fatura Santander (simoespaula)

## O que os logs mostram

O upload de hoje (23:02 UTC) funcionou bem no parser:

- Arquivo `fatura3.pdf`, tipo `cartao`, 132 lançamentos extraídos, total R$ 26.626,36 (bate 100% com o total impresso na fatura, `diff_cents=0`).
- Distribuição por cartão: **5178 → 103 linhas, 7014 → 15, 7239 → 11, 8021 → 3**.
- Nenhum erro de banco nesse período: as consultas de conciliação rodaram, apenas não encontraram candidatos.

Ou seja: o problema não é leitura do PDF nem falha técnica — é o **escopo da busca de candidatos**.

## Por que não deu match

A conta dela tem uma família de cartões Santander:

```text
VISA SANTANDER 7014  (cartão-pai)
  ├── VISA SANTANDER 5178
  ├── VISA GEOVANNA   7239
  └── VISA VITORIA    8021
```

A fatura é **consolidada** (uma fatura só, quatro cartões), mas a busca por lançamentos existentes filtra por **um único `credit_card_id`** — exatamente o cartão detectado/selecionado na linha. Nada de pai, filho ou irmão entra na busca.

Consequências confirmadas nos dados:

1. Os lançamentos que a fatura deveria reencontrar (vencimento 15/03/2026) estão nos cartões **filhos** 5178 e 7239. O cartão-pai 7014 não tem nenhum lançamento nesse vencimento. Se a linha cair no pai (seleção do usuário ou fallback para o pai), a busca volta vazia.
2. Linhas em que a IA não conseguiu identificar os 4 dígitos ficam **sem cartão** e são simplesmente puladas da conciliação — nascem como "novo", sem nem tentar buscar.

Vale registrar também o contexto de volume: hoje o sistema tem apenas **49 lançamentos** para essa fatura (R$ 3.471,16) contra **132 linhas** (R$ 26.626,36) do extrato. Mesmo com a correção, a maior parte das linhas é realmente nova — o que precisa parar de falhar são esses 49 mais os parcelados equivalentes.

## O que será feito

1. **Buscar candidatos na família do cartão, não em um cartão só.**
   A busca passa a considerar o cartão-pai e todos os seus filhos (o "grupo de fatura"). O vínculo continua sendo feito com o lançamento exato encontrado, e a linha continua sendo criada no cartão detectado — muda só o universo de busca.

2. **Linha sem cartão detectado deixa de ser ignorada.**
   Quando a IA não identifica os dígitos, a linha usa a família do cartão selecionado pelo usuário como escopo de busca, em vez de ficar de fora da conciliação.

3. **Empatar candidato do cartão certo primeiro.**
   No desempate, candidato do mesmo `credit_card_id` da linha ganha do candidato de um cartão irmão, para não vincular uma compra da Geovanna a um lançamento do Vitória por coincidência de valor.

4. **Diagnóstico visível.**
   Log no console com, por linha: cartão detectado, quantidade de candidatos na janela e motivo da rejeição (valor, data, parcela, similaridade). Isso encurta muito a investigação da próxima reclamação.

5. **Validação com o caso real.**
   Reprocessar o cenário da conta dela (fatura de vencimento 15/03/2026) e conferir que os 49 lançamentos já existentes aparecem como "vincular" em vez de "criar".

## Detalhes técnicos

- `src/hooks/useImportMatching.ts`: `findMatches` recebe a lista de IDs da família (pai + filhos) e troca `.eq("credit_card_id", cardId)` por `.in("credit_card_id", familyIds)` nas Waves A e C. Assinatura passa a aceitar `cardFamilyIds`.
- `src/components/lancamentos/ImportStatementModal.tsx`: monta o mapa de famílias a partir de `creditCards` (`parent_card_id`), agrupa as linhas por família em vez de por cartão, e usa a família do `targetCard` para linhas com `matched_card_id` indefinido.
- `src/lib/import/matching.ts`: `ScoreOptions` ganha `preferredCardId`; `scoreCandidate` soma um bônus pequeno quando `candidate.credit_card_id === preferredCardId` (desempate, não critério de corte).
- Sem migração de banco e sem alteração na edge function `parse-bank-statement`.
