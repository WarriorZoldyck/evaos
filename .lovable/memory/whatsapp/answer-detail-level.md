---
name: Nível de detalhe das respostas da EVA
description: Consultas de gasto/meta respondem só o valor; lista de lançamentos apenas quando pedida explicitamente
type: preference
---
Consultas da EVA (WhatsApp e chat do app) usam `detail_level`:
- `resumo` (padrão): só o valor consolidado (total, meta, saldo) + convite "Quer ver os lançamentos?".
- `detalhado`: lista os lançamentos — só quando o usuário pede ("quais lançamentos", "do que é", "detalha", "me mostra a lista"). `listar_lancamentos` é sempre detalhado.

Metas contam apenas o que está **Pago**; quando houver pendentes no mês da categoria, a resposta mostra uma linha "Pendente neste mês" para não parecer contradição com o total de gastos.
