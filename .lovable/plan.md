# Bloqueio de acesso para clientes inadimplentes

## O problema hoje

O sistema sabe quem está inadimplente, mas nunca impede o acesso:

- Existe apenas uma **faixa de aviso** no topo da tela. Nenhuma tela é realmente bloqueada — a tela de "Assinatura expirada" foi criada mas não é usada em lugar nenhum.
- Quem tem assinatura marcada como "ativa" nunca perde o acesso, mesmo com a data de vencimento vencida há meses. Hoje há assinaturas "ativas" com vencimento em maio e junho de 2026 ainda com acesso total.
- Não existe nenhuma rotina diária que verifique vencimentos: a situação só muda se a Asaas avisar, e se esse aviso falhar o cliente fica com acesso para sempre.
- O WhatsApp da EVA também não checa assinatura: mesmo bloqueado no site, o cliente continua lançando por lá.

## Como vai funcionar

1. **Aviso antes do bloqueio** (a partir do vencimento): faixa vermelha fixa no topo + tela de aviso ao entrar, informando o dia exato em que o acesso será bloqueado e com botão "Pagar agora" levando à fatura.
2. **Período de tolerância de 5 dias** após o vencimento, com contagem regressiva visível.
3. **Bloqueio efetivo** ao fim da tolerância: ao abrir qualquer página do sistema o cliente vê só a tela de "Acesso bloqueado", com o botão de pagamento. Continuam liberadas apenas: Minha Assinatura, Planos e Sair.
4. **Desbloqueio automático ao pagar**: a confirmação da Asaas reativa na hora. Também haverá um botão "Já paguei, atualizar" que consulta a Asaas na hora, para o caso de atraso no aviso.
5. **WhatsApp da EVA**: cliente bloqueado recebe uma mensagem curta avisando do bloqueio e o link para pagar, em vez do atendimento normal.
6. **Verificação diária automática**: uma rotina roda todo dia e marca como inadimplente quem passou do vencimento e como bloqueado quem passou da tolerância — mesmo sem aviso da Asaas.
7. **Equipe (EVA Hub)**: se o dono está bloqueado, os membros da equipe dele também ficam sem acesso aos dados, com mensagem explicando que o responsável precisa regularizar.
8. **Regularização dos casos atuais**: as assinaturas hoje marcadas como "ativas" mas com vencimento vencido entram no fluxo de aviso (não são bloqueadas de imediato), ganhando os 5 dias de tolerância a partir da ativação do recurso.

Os dados do cliente nunca são apagados — ficam apenas indisponíveis até o pagamento.

## Detalhes técnicos

- `useSubscription`: acrescentar avaliação por data — `active` com `next_due_date` vencido passa a contar como inadimplente; derivar `blockAt` (vencimento + 5 dias) e `daysToBlock`.
- Novo `SubscriptionGate` envolvendo o `Outlet` em `AppLayout` (e `HubLayout`): renderiza `SubscriptionBlockedScreen` quando bloqueado, liberando as rotas `/configuracoes/assinatura` e `/planos`.
- `SubscriptionBanner`: novo estado "vence em X dias / bloqueio em X dias" com link para a fatura (`invoice_url`).
- Nova Edge Function agendada (pg_cron diário) `subscription-enforce`: define `past_due` + `grace_until` para vencidos e `expired` para quem passou da tolerância.
- `asaas-webhook`: em `PAYMENT_CONFIRMED/RECEIVED`, limpar `grace_until` e voltar para `active` (já existe); garantir tratamento de `PAYMENT_OVERDUE` também para cobrança avulsa.
- Nova Edge Function `subscription-refresh` para o botão "Já paguei".
- Reforço no servidor: aplicar `has_active_subscription(auth.uid())` nas políticas de escrita das tabelas operacionais (lançamentos, contas, cartões, categorias etc.) e checagem nas funções `whatsapp-webhook` e `eva-chat`, para que o bloqueio não dependa só da interface.

## Pontos a confirmar

- Tolerância de 5 dias após o vencimento está boa?
- Durante o bloqueio, prefere acesso somente leitura (ver dados, não lançar) em vez do bloqueio total?
