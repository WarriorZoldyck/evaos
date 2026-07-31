---
name: Ancoragem das datas de parcelas
description: A 1ª parcela é ancorada na Data de Pagamento efetiva; ciclo do cartão só define a âncora quando o usuário não informou data própria.
type: feature
---
Regra única para gerar datas de parcelas (`buildInstallmentDates` em `src/lib/creditCardDueDate.ts`):

- A parcela 1 é ancorada na **Data de Pagamento efetiva** do formulário; as demais avançam mês a mês (ou a cada N dias no modo `custom_days`), com clamp de dia em meses curtos.
- Datas editadas manualmente na tabela de prévia sempre prevalecem.
- O ciclo do cartão (`getCreditCardDueDate` com fechamento/vencimento) só define a âncora quando o usuário NÃO informou data de pagamento própria — nesse caso o formulário já grava essa data no campo, para prévia e gravação nunca divergirem.

**Why:** bug real — competência antiga (2025) + pagamento futuro (2026) fazia o sistema reancorar na competência e gravar as parcelas um ano antes do que a prévia mostrava.
