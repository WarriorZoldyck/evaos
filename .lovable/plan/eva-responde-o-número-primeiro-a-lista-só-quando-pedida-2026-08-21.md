# EVA responde o número primeiro, a lista só quando pedida

Hoje toda consulta de categoria despeja a lista inteira de lançamentos junto com o total. Quando o usuário pergunta "quanto gastei em alimentação em julho?" ou "qual minha meta de lazer?", ele quer o **valor**, não 22 linhas.

## O que muda

### 1. Nível de detalhe na consulta
O classificador passa a devolver um campo novo `detail_level`:
- `resumo` (padrão) — só o valor consolidado.
- `detalhado` — lista os lançamentos.

`detalhado` só é usado quando a pergunta pede explicitamente os itens: "quais lançamentos", "do que é isso", "me mostra a lista", "detalha", "o que compõe esse valor", "extrato de...".

Como a EVA já enxerga o histórico da conversa, um "quais foram?" logo depois do resumo reabre a mesma consulta com `detail_level: "detalhado"`.

### 2. Formato resumido

Gastos de categoria:
```text
📊 Gastos com "Alimentação" em julho/2026 (Pessoal)
💰 Total: R$ 10.600,07 (22 lançamentos)
```
Meta de categoria (sem o bloco de gastos colado embaixo):
```text
📊 Meta de Lazer (Pessoal) — saída
• Meta do mês: R$ 1.250,65
• Já realizado: R$ 245,15 (20% da meta)
• Ainda cabe: R$ 1.005,50
```
Nos dois casos, um rodapé curto convidando: "Quer ver os lançamentos?".

### 3. Metas e gastos param de se contradizer
Na tela do WhatsApp em anexo a meta mostra "Já realizado: R$ 0,00" e logo abaixo "Total: R$ 245,15". A diferença é que o relatório de metas conta só o que está **Pago** e a listagem conta também o **Pendente**. O resumo passa a explicitar isso quando houver pendentes: `Já realizado: R$ 0,00 (+ R$ 245,15 pendente)`, usando a mesma base de cálculo dos dois lados.

### 4. Perguntas múltiplas continuam funcionando
"Qual minha meta de lazer e quanto gastei nessa categoria?" segue respondendo as duas coisas — mas as duas em formato resumido, um bloco curto cada.

## Detalhes técnicos

- `supabase/functions/whatsapp-webhook/index.ts`: novo campo `detail_level` no JSON de consulta + regras no prompt; cases `gastos_categoria`, `listar_lancamentos` e `agrupar_por_categoria` passam a montar lista só quando `detail_level === "detalhado"`; `meta_categoria` ganha o desdobramento pago/pendente e deixa de anexar a lista.
- `supabase/functions/eva-chat/index.ts`: mesmos ajustes, para o chat do app e o WhatsApp responderem igual.
- O total continua calculado sobre todos os lançamentos do período (não apenas os exibidos).
- Sem mudança de banco de dados. Deploy das duas Edge Functions ao final e teste com as duas perguntas do exemplo.
