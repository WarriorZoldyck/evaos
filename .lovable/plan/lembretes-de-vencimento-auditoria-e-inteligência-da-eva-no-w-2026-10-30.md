# Lembretes de vencimento + auditoria e inteligência da EVA no WhatsApp

## 1. Lembretes de vencimento (o erro dos e-mails)

**Causa encontrada:** a rotina de lembretes procura no cadastro do usuário 4 informações que não existem (horário do lembrete, só dias úteis, data do último envio). A consulta falha e a rotina inteira para com erro antes de enviar qualquer mensagem — é esse o erro que chega no seu e-mail. Também não há agendamento diário ativo dela no banco hoje.

Correção:
- Criar os campos que faltam no perfil (horário padrão 09:00, só dias úteis = não, último envio).
- Proteger a rotina: um usuário com problema (número inválido, WhatsApp fora) não derruba os demais; cada falha fica registrada.
- Evitar envio duplicado no mesmo dia.
- Agendar a rotina para rodar de hora em hora (cada usuário recebe no horário dele, padrão 09:00 de Brasília).
- **Teste real:** disparar agora para todos os usuários com lembrete ativo, enviando os próximos vencimentos (conforme os dias de antecedência de cada um), e te trazer o relatório: quem recebeu, quem não tinha vencimentos, quem falhou e por quê.

## 2. Auditoria das conversas de outubro

Já são 307 mensagens de usuários e 307 respostas neste mês. Vou ler todas e entregar um relatório com:
- Onde ela errou (conta/categoria/contexto errado, perguntas desnecessárias, respostas fora do pedido, não entendeu áudio/documento).
- Exemplos reais de cada tipo e a correção aplicada nas regras dela.

## 3. EVA atuando como CFO após o lançamento (metas)

Depois de confirmar um lançamento de despesa, se a categoria estiver ligada a uma meta orçamentária do usuário (no mesmo contexto Pessoal/Empresa), ela manda **uma segunda mensagem**:

> "📊 Atenção: *Alimentação* faz parte da sua meta de R$ 1.500/mês. Você já usou R$ 1.120 (75%) e faltam R$ 380 para 30 de outubro. No ritmo atual, vai fechar o mês em ~R$ 1.680 — R$ 180 acima. Sugestão: segurar gastos fora de casa até o fim do mês."

Regras:
- Usa o total do mês da categoria (incluindo o lançamento novo e os que estão em Análises EVA).
- Projeção pelo ritmo diário do mês.
- Tons diferentes: dentro (abaixo de 70%), atenção (70–100%), estourou (acima de 100%).
- Também cobre receitas com meta de faturamento ("faltam R$ X para bater a meta").
- Nada é enviado se a categoria não tiver meta.

## Detalhes técnicos
- Migração: `profiles` + `whatsapp_reminders_time text default '09:00'`, `whatsapp_reminders_weekdays_only boolean default false`, `whatsapp_reminders_last_sent_date date`.
- `cron-whatsapp-reminders`: try/catch por usuário, grava last_sent_date, resposta com resumo; job pg_cron horário com `x-cron-secret`.
- Teste: invocar com `force: true` para todos e listar resultados.
- `whatsapp-webhook`: após envio da confirmação, helper `buildBudgetInsight(userId, companyId, category, type)` lendo `budget_targets` + transações do mês; envia via Evolution como segunda mensagem (falha nunca afeta o lançamento).
- Ajustes de prompt derivados da auditoria em `_shared/eva-knowledge.ts` / prompt do webhook.
