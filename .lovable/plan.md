

## Adicionar Intenção "Editar Lançamento" via WhatsApp

### Problema
Quando o usuário pede para editar o valor (ou outro campo) de um lançamento existente, a EVA cria um novo lançamento ao invés de atualizar o existente. Não existe a intenção `editar_lancamento` no sistema.

### Plano

**1. Atualizar o System Prompt** (~linhas 856-963)
- Adicionar intenção `"editar_lancamento"` ao lado de `"lancamento"`, `"consulta"`, `"gerenciar_categoria"`, `"conversa"`
- Formato JSON de resposta:
  ```json
  {"intent":"editar_lancamento","transaction_id":"UUID-ou-null","field":"amount|description|category_id|payment_date|status|account_id|notes","new_value":"...","friendly_message":"..."}
  ```
- Regras no prompt:
  - Se o usuário diz "muda o valor", "corrige pra X", "era R$Y não R$Z", "edita aquele lançamento", classificar como `editar_lancamento`
  - A IA deve usar o **histórico da conversa** para identificar qual lançamento o usuário se refere (o último criado, ou o mencionado anteriormente)
  - Se não conseguir identificar o lançamento, `transaction_id` = null e a EVA pergunta qual lançamento editar

**2. Buscar lançamento pelo contexto da conversa** (novo bloco após o handler de `lancamento`)
- Quando `transaction_id` é null, buscar os lançamentos recentes do usuário (últimas 24h, até 10) e cruzar com o contexto da conversa (descrição, valor, etc.) para encontrar o correto
- Se a IA retornar `transaction_id`, validar que pertence ao `user_id`
- Se múltiplos candidatos, perguntar qual usando `pending_actions`

**3. Novo handler `editar_lancamento`** (~após linha 1498)
- Mapear `field` para a coluna real da tabela `transactions`
- Campos editáveis: `amount`, `description`, `category` (com resolução de UUID), `payment_date`, `competence_date`, `status`, `bank_account_id`/`wallet_id`, `notes`
- Executar `supabase.from("transactions").update({ [column]: newValue }).eq("id", transactionId).eq("user_id", userId)`
- Responder com confirmação mostrando o que mudou

**4. Enriquecer o prompt com lançamentos recentes**
- Adicionar ao system prompt os últimos 5-10 lançamentos criados (id, descrição, valor, data) para que a IA possa referenciar o correto por `transaction_id`

### Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts`

