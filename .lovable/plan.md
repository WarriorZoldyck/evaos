

## Correção: Contexto de Conta e Parcelamento via WhatsApp

### Problema 1: Conta no contexto errado

Quando o usuário menciona uma conta (ex: "Itaú Pessoal IT"), a IA pode retornar um `account_id` que pertence ao contexto "Pessoal", mas classificar o lançamento no contexto de uma empresa (ou vice-versa). O código atual (linha ~1588) só procura a conta dentro do contexto escolhido pela IA (`contextAccounts`). Se não encontra, cai no fluxo de "múltiplas contas" e pergunta de novo.

**Solução**: Adicionar resolução cross-context para contas, similar ao que já existe para categorias. Se o `account_id` retornado pela IA não for encontrado no contexto atual, buscar em TODAS as contas do usuário. Se encontrar, usar o contexto DAQUELA conta (ajustar `companyId` e re-filtrar categorias se necessário). Isso garante que se a IA acertar a conta pelo nome mas errar o contexto, o sistema corrige automaticamente.

Além disso, reforçar no prompt da IA que o nome da conta já indica o contexto (está listada dentro de `[Pessoal]` ou `[NomeEmpresa]`).

### Problema 2: NFs parceladas criando lançamento único

Quando uma NF tem boletos parcelados, a IA deve retornar `installments > 1` com `installment_details`. O código já suporta isso (linha ~1826), mas há dois gaps:
- O prompt pede que `amount` seja o valor total, mas quando a IA não retorna `installment_details`, o sistema cria um único lançamento com o valor cheio em vez de parcelas.
- Reforçar no prompt que CADA boleto listado em uma NF é uma parcela separada, e que o sistema NUNCA deve criar um lançamento único com o valor total quando há parcelas evidentes.

### Arquivo alterado

`supabase/functions/whatsapp-webhook/index.ts`:

1. **Cross-context account resolution** (~linha 1587-1598): Se `account_id` não for encontrado no contexto, buscar em `accounts` (todas). Se encontrar, sobrescrever `companyId` com o `company_id` da conta encontrada e re-filtrar `contextAccounts`, `contextWallets`, `contextCards` e `contextCategories`.

2. **Reforço no prompt** (~linha 1195): Adicionar instrução explícita: "A conta [Nome] listada em [Pessoal] é uma conta PESSOAL. NÃO a classifique em contexto de empresa. O contexto deve corresponder ao bloco onde a conta está listada."

3. **Reforço de parcelamento no prompt** (~linha 1170): Tornar mais explícito que se a NF lista múltiplos boletos/duplicatas com vencimentos diferentes, OBRIGATORIAMENTE usar `installments` e `installment_details`, nunca lançar como valor único.

