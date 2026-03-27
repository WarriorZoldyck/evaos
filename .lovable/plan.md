

# Resolução Cross-Context de Cartões de Crédito

## Problema

Quando o usuário envia um comprovante de cartão PJ, a IA pode escolher o contexto "Pessoal" por engano. O sistema já tem lógica de **cross-context** para contas bancárias (linhas 1880-1912) — se a conta não é encontrada no contexto atual, busca em TODOS os contextos e reatribui automaticamente. Porém, **para cartões de crédito essa lógica não existe**. O match de cartão só busca dentro de `contextCards` (já filtrado pelo `companyId` da IA), então o cartão PJ nunca é encontrado quando a IA diz "Pessoal".

## Correção

### `supabase/functions/whatsapp-webhook/index.ts`

Após o bloco de match de cartão por UUID, nome e dígitos dentro de `contextCards` (linhas 1778-1821), adicionar um **fallback cross-context** que busca em TODOS os cartões (`creditCards` sem filtro de company):

1. Se `cardMatch` não foi encontrado em `contextCards`, repetir a busca por UUID, last_four_digits e nome em `creditCards` (lista completa)
2. Se encontrar um match cross-context:
   - Atualizar `companyId` para o `company_id` do cartão encontrado
   - Re-filtrar `contextAccounts`, `contextWallets`, `contextCards`, `contextCategories` (mesmo padrão da linha 1894-1906)
   - Atribuir `creditCardId` e `bankAccountId`
   - Logar a resolução cross-context
3. Se o cartão tem `last_four_digits` visíveis na imagem mas a IA não retornou `credit_card_id`, adicionar busca nos dígitos da imagem/mensagem contra TODOS os cartões (não só `contextCards`)

Isso replica exatamente o padrão já usado para contas bancárias, garantindo que o cartão determine o contexto correto automaticamente.

## Arquivo afetado

| Arquivo | Ação |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar fallback cross-context no bloco de resolução de cartão de crédito |

