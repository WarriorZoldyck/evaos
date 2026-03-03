

# WhatsApp Webhook: Contexto (Empresa) + Validação de Categoria

## Problema atual

A edge function `whatsapp-webhook` não busca empresas do usuário, então todo lançamento vai sem `company_id` (Pessoal). Além disso, as categorias e contas enviadas ao prompt da IA não distinguem por contexto -- a IA pode sugerir uma categoria que pertence a uma empresa diferente, ou o `bank_account_id` errado.

## Mudanças no `supabase/functions/whatsapp-webhook/index.ts`

### 1. Buscar empresas do usuário

Adicionar ao bloco de fetch paralelo (linha 69-73):
- `supabase.from("companies").select("id, name, cnpj").eq("user_id", userId)`

### 2. Incluir contexto no prompt da IA

Adicionar ao system prompt:
- Lista de contextos: `"Pessoal"` + nomes das empresas
- Categorias agrupadas por contexto (filtrando `company_id` null = Pessoal, ou o id da empresa)
- Contas agrupadas por contexto

Instruir a IA a retornar `"context": "Pessoal" | "Nome da Empresa"` no JSON de lançamento e consulta.

### 3. Validar categoria retornada pela IA

Após parsear a resposta da IA, antes de inserir:
- Resolver o `company_id` a partir do `context` retornado (match por nome)
- Verificar se a `category` retornada existe nas categorias do contexto escolhido
- Se não existir, fazer fallback para "Outros"
- Filtrar contas bancárias pelo `company_id` para escolher o `bank_account_id` correto

### 4. Inserir com `company_id`

No `insert` da transação (linha 207-218):
- Adicionar `company_id` resolvido (ou `null` para Pessoal)
- Filtrar `bank_account_id` apenas entre contas do contexto

### 5. Consultas com contexto

Nas queries de saldo, gastos, resumo etc:
- Se a IA retornar `context`, filtrar por `company_id`
- Se não especificar, mostrar dados consolidados (comportamento atual)

### Arquivo alterado
- `supabase/functions/whatsapp-webhook/index.ts`

### Nenhuma migração necessária
A tabela `transactions` já tem `company_id`. Nenhum dado existente é alterado.

