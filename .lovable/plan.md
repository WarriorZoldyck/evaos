

## Tornar a EVA mais inteligente com notas fiscais — contexto automático e parcelamento

### Problemas identificados

1. **Contexto errado**: Quando o usuário envia uma NF com razão social de uma empresa cadastrada, a EVA pergunta "em qual conta?" mostrando contas pessoais. Deveria identificar automaticamente que pertence à empresa e usar o contexto correto.

2. **Sem suporte a parcelamento**: A NF pode conter parcelas/boletos, mas a EVA cria um lançamento único. Deveria criar múltiplas parcelas automaticamente.

### Solução (2 partes)

#### 1. Auto-detecção de contexto via CNPJ/razão social
- Adicionar instrução explícita no system prompt para que a IA, ao analisar documentos (NF, boleto, recibo), procure CNPJ ou razão social e cruze com as empresas cadastradas do usuário
- Reforçar que se encontrar match, deve usar o contexto da empresa e NÃO "Pessoal"
- Incluir os CNPJs das empresas de forma mais proeminente no prompt

#### 2. Suporte a parcelamento via WhatsApp
- Adicionar novos campos no formato de resposta da IA: `installments` (número de parcelas), `installment_details` (array com `{amount, due_date}` de cada parcela)
- No webhook, quando `installments > 1`, criar múltiplas transações com `series_id`, `installment_number` e `installments_total` — igual ao que o sistema web já faz
- Cada parcela terá sua própria `payment_date` e status "Pendente"

### Detalhes técnicos

**Arquivo:** `supabase/functions/whatsapp-webhook/index.ts`

**Mudanças no system prompt:**
- Adicionar regra: "Ao analisar documentos (NF, boleto, recibo), SEMPRE verifique se o CNPJ ou razão social corresponde a alguma empresa do usuário. Se sim, use o contexto dessa empresa."
- Adicionar formato de resposta com campos de parcelamento:
  ```
  "installments": 3,
  "installment_details": [
    {"amount": 500.00, "due_date": "2026-04-10"},
    {"amount": 500.00, "due_date": "2026-05-10"},
    {"amount": 500.00, "due_date": "2026-06-10"}
  ]
  ```

**Mudanças na lógica de criação:**
- Após resolver contexto, categoria e conta, verificar se `installments > 1`
- Se sim, gerar `series_id` (UUID) e criar N transações em loop, cada uma com:
  - `series_id` compartilhado
  - `installment_number` (1, 2, 3...)
  - `installments_total` (total de parcelas)
  - `payment_date` da parcela específica
  - `competence_date` fixo (data do serviço/compra)
  - `status: "Pendente"` (exceto 1ª parcela se já venceu)
- Mensagem de confirmação mostra todas as parcelas criadas

**Mudanças na escolha de conta (choose_account):**
- Preservar `installments` e `installment_details` no payload do pending action para que, ao escolher a conta, as parcelas sejam criadas corretamente

### Resultado esperado
- NF de empresa → EVA já lança no contexto correto sem perguntar
- NF parcelada → EVA cria todas as parcelas automaticamente com datas corretas
- Menos perguntas desnecessárias = experiência mais fluida

