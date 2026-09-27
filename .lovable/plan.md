# Ajuste retroativo do Vitor + aviso + campos obrigatórios nos lançamentos

## 1. Corrigir os 35 lançamentos antigos do Vitor
- Preencher a conta de pagamento nos 35 lançamentos do cartão VITOR F MENDES que estão sem conta.
- Como eles estão em faturas fechadas, a trava de fatura fechada será desligada só durante essa correção e religada logo depois. Nenhum valor, data ou status muda, só o vínculo com a conta.
- No fim, confirmar que não sobrou nenhum lançamento de cartão sem conta em toda a base.

## 2. Avisar o Vitor
- **WhatsApp:** uma mensagem única e curta:
  "Olá, Vitor! Fizemos uma atualização no EVA OS: seus lançamentos de cartão antigos agora aparecem ligados à conta que paga a fatura. Assim, os filtros por conta e o valor de 'Pagar fatura' passam a bater. Nenhum valor foi alterado. Qualquer dúvida, é só responder aqui."
- **No sistema:** um aviso de "Atualização do sistema" que aparece na próxima vez que ele entrar, com o mesmo texto e um botão "Entendi". Depois que ele clicar, o aviso não aparece de novo.
- O aviso fica guardado de um jeito que dá para reaproveitar em avisos futuros para qualquer usuário.

## 3. Travas para não salvar lançamento incompleto
Na tela de novo lançamento/edição, o botão Salvar só funciona quando estes campos estiverem preenchidos. Cada campo que faltar fica marcado em vermelho com a explicação:
- Descrição, valor (maior que zero), tipo (receita/despesa), data de competência e data de pagamento
- Contexto (Pessoal ou empresa)
- Categoria
- Forma de pagamento e, conforme ela:
  - Cartão de crédito (despesa): cartão obrigatório
  - Cartão (receita): maquininha obrigatória
  - PIX, boleto, transferência, débito etc.: conta bancária obrigatória
  - Dinheiro: carteira obrigatória
- Parcelado: número de parcelas de 2 para cima

Cadastro de cartão de crédito: a "conta que paga a fatura" passa a ser obrigatória. Um cartão sem essa conta não pode ser escolhido num lançamento até ser completado, e o sistema mostra um aviso com o atalho para editar o cartão.

A mesma regra também vale para o banco de dados, para que lançamentos vindos do WhatsApp, da importação ou de integrações não entrem sem conta, cartão ou carteira. Se a EVA no WhatsApp não descobrir qual é a conta, ela pergunta antes de lançar, em vez de salvar incompleto. Na importação, as linhas incompletas ficam destacadas e bloqueiam a finalização até serem corrigidas.

## Detalhes técnicos
- Migração: `ALTER TABLE transactions DISABLE TRIGGER` na trava de fatura fechada, `UPDATE` com o `bank_account_id` do cartão para os 35, e depois `ENABLE`.
- Nova tabela `system_notices` (user_id, title, body, seen_at) com GRANT e RLS para o próprio usuário. Um componente `SystemNoticeDialog` no layout do painel busca os avisos que o usuário ainda não viu.
- WhatsApp: Edge Function temporária de uso único pela Evolution API (mesmo modelo do `notify-once`), apagada depois de usar.
- Formulário: esquema zod de `TransactionFormModal` com `superRefine` condicional à forma de pagamento; `PaymentMethodFields` exibe `FormMessage`.
- Banco: trigger de validação `validate_transaction_required` (BEFORE INSERT) que exige descrição, valor maior que 0 e ao menos um de bank_account_id/credit_card_id/wallet_id/card_terminal_id em lançamentos novos. Os registros antigos não são afetados.
- `whatsapp-webhook`/`eva-chat`: se não houver conta, perguntar antes de inserir. `ImportStatementModal`: validar as linhas antes de finalizar.
